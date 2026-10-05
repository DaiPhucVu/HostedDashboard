import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from app.domain.models import JobInput
from app.repositories.fixtures import FixtureRepository
from app.retrieval.fts5 import Fts5KnowledgeIndex
from app.triage.rules import RuleTriageService, load_taxonomy
from app.triage.semantic import (
    OllamaSemanticTriageClient,
    SemanticConfigurationError,
    SemanticRagTriageService,
    SemanticTriageError,
    create_semantic_triage_client,
)


ROOT = Path(__file__).resolve().parents[1]


class FakeSemanticClient:
    model = "fake-qwen"
    provider = "fake"

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def generate(self, job, evidence, taxonomy):
        self.calls.append({"job": job, "evidence": evidence, "taxonomy": taxonomy})
        if self.error:
            raise self.error
        return self.result


class FakeHttpResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def semantic_result(**overrides):
    result = {
        "category_id": "electrical",
        "urgency": "HIGH",
        "required_skills": ["plumbing"],
        "description_complete": True,
        "missing_information": [],
        "issue_summary": "Burning smell is coming from a wall outlet.",
        "extracted_issues": ["burning smell", "wall outlet"],
        "language": "en",
        "safety_flags": ["possible overheating"],
        "reason_codes": ["burning smell evidence"],
        "confidence": 0.91,
    }
    result.update(overrides)
    return result


class SemanticRagTriageTests(unittest.TestCase):
    def setUp(self):
        repository = FixtureRepository(ROOT / "fixtures")
        self.index = Fts5KnowledgeIndex(repository.list_documents())
        self.taxonomy = load_taxonomy(ROOT / "taxonomy/service_taxonomy.json")
        self.rules = RuleTriageService(self.taxonomy, self.index)

    def job(self, description="There is a burning smell from the wall outlet"):
        return JobInput(
            job_id="semantic-job",
            description=description,
            location_text="Banani",
            latitude=23.7937,
            longitude=90.4066,
            start_at="2026-09-01T10:00:00+06:00",
        )

    def test_qwen_reads_full_fts5_evidence_and_returns_guarded_structure(self):
        client = FakeSemanticClient(semantic_result())
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)

        result = service.triage(self.job())

        self.assertEqual("electrical", result.category_id)
        self.assertEqual(("electrical",), result.required_skills)
        self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
        self.assertEqual("Burning smell is coming from a wall outlet.", result.issue_summary)
        self.assertIn("POSSIBLE_OVERHEATING", result.safety_flags)
        self.assertIn("FTS5_EVIDENCE_GROUNDED", result.reason_codes)
        self.assertIn("REQUIRED_SKILLS_CANONICALISED", result.reason_codes)
        self.assertTrue(result.model_version.startswith(
            "semantic-rag-v4-controlled-override-fake-fake-qwen"
        ))
        self.assertEqual(1, len(client.calls))
        evidence = client.calls[0]["evidence"]
        self.assertTrue(all(item.title and item.body for item in evidence))

    def test_rule_urgency_is_a_floor_llm_cannot_downgrade(self):
        client = FakeSemanticClient(semantic_result(urgency="NORMAL"))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)

        result = service.triage(self.job("Smoke is coming from an electrical socket"))

        self.assertEqual("CRITICAL", result.urgency)
        self.assertIn("URGENCY_RULE_FLOOR_APPLIED", result.reason_codes)

    def test_llm_failure_falls_back_to_deterministic_rules(self):
        client = FakeSemanticClient(error=SemanticTriageError("offline"))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)

        result = service.triage(self.job())

        self.assertEqual("electrical", result.category_id)
        self.assertIn("SEMANTIC_FALLBACK", result.reason_codes)
        self.assertEqual("rules-bm25-v1+semantic-fallback", result.model_version)

    def test_unknown_llm_category_is_rejected_by_guard(self):
        client = FakeSemanticClient(semantic_result(category_id="roofing"))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)

        result = service.triage(self.job())

        self.assertNotEqual("roofing", result.category_id)
        self.assertIn("SEMANTIC_INVALID_CATEGORY", result.reason_codes)

    def test_no_evidence_still_uses_semantic_layer_for_description_completeness(self):
        client = FakeSemanticClient(semantic_result(
            category_id=None,
            required_skills=[],
            urgency="NORMAL",
            description_complete=False,
            missing_information=["description", "location", "schedule"],
            confidence=0.2,
        ))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)

        result = service.triage(self.job("Please help, it is not working"))

        self.assertEqual(1, len(client.calls))
        self.assertEqual([], client.calls[0]["evidence"])
        self.assertEqual("MANUAL_REVIEW", result.triage_status)
        self.assertIn("description", result.missing_fields)
        self.assertIn("RAG_NO_EVIDENCE", result.reason_codes)
        self.assertIn("UNGROUNDED_CATEGORY", result.reason_codes)

    def test_known_broad_category_remains_assignable_when_exact_item_is_missing(self):
        client = FakeSemanticClient(semantic_result(
            category_id="appliance_repair",
            required_skills=["appliance_repair"],
            urgency="NORMAL",
            description_complete=False,
            missing_information=["description"],
            issue_summary="Customer requests appliance repair without naming the appliance.",
            extracted_issues=["unspecified appliance repair"],
            safety_flags=[],
            confidence=0.72,
        ))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)
        vague_job = JobInput(
            job_id="vague-appliance",
            description="repair please",
            category_hint="appliance_repair",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
            start_at="2026-09-10T10:00:00+06:00",
        )

        result = service.triage(vague_job)

        self.assertEqual("appliance_repair", result.category_id)
        self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
        self.assertIn("description", result.missing_fields)
        self.assertIn("LIMITED_DESCRIPTION_NON_BLOCKING", result.reason_codes)

    def test_valid_category_hint_recovers_when_model_returns_no_category(self):
        client = FakeSemanticClient(semantic_result(
            category_id=None,
            required_skills=[],
            urgency="NORMAL",
            description_complete=False,
            missing_information=["description"],
            confidence=0.2,
        ))
        empty_index = Fts5KnowledgeIndex([])
        service = SemanticRagTriageService(self.taxonomy, empty_index, client)

        result = service.triage(JobInput(
            job_id="hint-fallback",
            description="help",
            category_hint="appliance_repair",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
            start_at="2026-09-10T10:00:00+06:00",
        ))

        self.assertEqual("appliance_repair", result.category_id)
        self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
        self.assertGreaterEqual(result.confidence, 0.90)
        self.assertIn("SEMANTIC_CATEGORY_HINT_FALLBACK", result.reason_codes)
        self.assertIn("CATEGORY_HINT_GROUNDED", result.reason_codes)
        self.assertNotIn("UNGROUNDED_CATEGORY", result.reason_codes)

    def test_unverified_category_conflict_requires_manual_review(self):
        client = FakeSemanticClient(semantic_result(
            category_id="cleaning",
            required_skills=["cleaning"],
            urgency="CRITICAL",
            description_complete=False,
            missing_information=["description"],
            issue_summary="Customer requests a general wellness service.",
            extracted_issues=["general wellness request"],
            safety_flags=["unrelated hazard"],
            confidence=0.75,
        ))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)

        result = service.triage(JobInput(
            job_id="app-category-anchor",
            description="Need a general service",
            category_hint="beauty_wellness",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
            start_at="2026-09-10T10:00:00+06:00",
        ))

        self.assertEqual("beauty_wellness", result.category_id)
        self.assertEqual(("beauty_wellness",), result.required_skills)
        self.assertEqual("MANUAL_REVIEW", result.triage_status)
        self.assertIn("CATEGORY_SEMANTIC_CONFLICT", result.reason_codes)
        self.assertIn("CATEGORY_OVERRIDE_CONFIDENCE_LOW", result.reason_codes)
        self.assertEqual("Need a general service", result.issue_summary)
        self.assertNotIn("general wellness request", result.extracted_issues)
        self.assertEqual("NORMAL", result.urgency)
        self.assertEqual((), result.safety_flags)

    def test_semantic_override_requires_model_and_keyword_agreement(self):
        client = FakeSemanticClient(semantic_result(
            category_id="appliance_repair",
            required_skills=["appliance_repair"],
            urgency="NORMAL",
            issue_summary="Washing machine is leaking.",
            extracted_issues=["washing machine", "leaking"],
            safety_flags=[],
            confidence=0.92,
        ))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)
        job = JobInput(
            job_id="wrong-app-category",
            description="Washing machine is leaking",
            category_hint="ac_repair",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
            start_at="2026-09-10T10:00:00+06:00",
        )

        result = service.triage(job)

        self.assertEqual("appliance_repair", result.category_id)
        self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
        self.assertEqual("ac_repair", result.original_category)
        self.assertEqual("appliance_repair", result.semantic_category)
        self.assertEqual("appliance_repair", result.final_category)
        self.assertEqual("SEMANTIC_OVERRIDE", result.category_decision)
        self.assertEqual("WASHING_MACHINE_ENTITY", result.override_reason)
        self.assertIn("CATEGORY_SEMANTIC_OVERRIDE", result.reason_codes)

    def test_high_confidence_without_keyword_agreement_keeps_manual_review(self):
        client = FakeSemanticClient(semantic_result(
            category_id="appliance_repair",
            required_skills=["appliance_repair"],
            urgency="NORMAL",
            issue_summary="Appliance request",
            extracted_issues=["appliance"],
            safety_flags=[],
            confidence=0.95,
        ))
        service = SemanticRagTriageService(self.taxonomy, self.index, client, self.rules)
        job = JobInput(
            job_id="unverified-conflict",
            description="Please help with this service",
            category_hint="ac_repair",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
            start_at="2026-09-10T10:00:00+06:00",
        )

        result = service.triage(job)

        self.assertEqual("ac_repair", result.category_id)
        self.assertEqual("MANUAL_REVIEW", result.triage_status)
        self.assertEqual("MANUAL_REVIEW", result.category_decision)
        self.assertIn("CATEGORY_OVERRIDE_ENTITY_MISSING", result.reason_codes)

    def test_ollama_request_contains_full_evidence_and_json_schema(self):
        evidence = self.index.retrieve("burning smell from wall outlet", limit=5)
        structured = semantic_result(required_skills=["electrical"])
        response = FakeHttpResponse({
            "message": {"role": "assistant", "content": json.dumps(structured)},
            "done": True,
        })
        client = OllamaSemanticTriageClient(model="qwen3:8b", timeout_seconds=1)

        with patch("app.triage.semantic.urlopen", return_value=response) as mocked:
            result = client.generate(self.job(), evidence, self.taxonomy)

        self.assertEqual("electrical", result["category_id"])
        request = mocked.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual("qwen3:8b", payload["model"])
        self.assertFalse(payload["stream"])
        self.assertFalse(payload["think"])
        self.assertEqual("object", payload["format"]["type"])
        prompt = json.loads(payload["messages"][1]["content"])
        self.assertTrue(prompt["retrievedInternalKnowledge"])
        self.assertIn("body", prompt["retrievedInternalKnowledge"][0])

    def test_provider_factory_selects_ollama(self):
        with patch.dict(os.environ, {"HANDYMAN_AI_PROVIDER": "ollama"}, clear=True):
            self.assertIsInstance(create_semantic_triage_client(), OllamaSemanticTriageClient)

    def test_unknown_provider_fails_fast(self):
        with patch.dict(os.environ, {"HANDYMAN_AI_PROVIDER": "unsupported"}, clear=True):
            with self.assertRaises(SemanticConfigurationError):
                create_semantic_triage_client()


if __name__ == "__main__":
    unittest.main()
