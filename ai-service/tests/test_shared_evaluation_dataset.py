import json
import unittest
from collections import Counter, defaultdict
from pathlib import Path

from app.domain.models import JobInput, ProviderProfile, TriageResult
from app.ranking.weighted import WeightedProviderRanker
from app.services.auto_assignment import AutoAssignmentDecisionService
from app.services.firebase_data_adapter import FirebaseDataAdapter


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "fixtures" / "firebase_shared_eval_v2"


class SharedEvaluationDatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((DATASET / "manifest.json").read_text(encoding="utf-8"))
        cls.export = json.loads((DATASET / "firebase-export.json").read_text(encoding="utf-8"))
        cls.cases = json.loads((DATASET / "evaluation-cases.json").read_text(encoding="utf-8"))
        cls.adapter = FirebaseDataAdapter(ROOT / "taxonomy" / "service_taxonomy.json")

    def test_has_exactly_100_versioned_providers_across_every_family(self):
        providers = self.export["Handyman"]
        self.assertEqual(100, len(providers))
        counts = Counter()
        for provider_id, provider in providers.items():
            self.assertEqual(provider_id, provider["handymanId"])
            self.assertTrue(provider["testData"])
            self.assertEqual(self.manifest["datasetVersion"], provider["datasetVersion"])
            self.assertTrue(provider["bio"])
            self.assertTrue(provider["area"])
            self.assertTrue(provider["certificateType1"])
            counts[provider["skills"][0]] += 1
        self.assertEqual(set(self.manifest["serviceFamilies"]), set(counts))
        self.assertEqual(dict(sorted(counts.items())), self.manifest["providersPerFamily"])

    def test_every_family_has_four_complete_eligible_providers(self):
        providers_by_family = defaultdict(list)
        for provider in self.export["Handyman"].values():
            providers_by_family[provider["skills"][0]].append(provider)
        for family in self.manifest["serviceFamilies"]:
            eligible = [
                provider for provider in providers_by_family[family]
                if provider["verificationStatus"] == "approved"
                and provider["available"] is True
                and provider["latitude"] is not None
                and provider["longitude"] is not None
                and provider["serviceRadiusKm"] > 0
                and provider["maxConcurrentJobs"] > 0
            ]
            self.assertGreaterEqual(len(eligible), 4, family)

    def test_history_reviews_and_indexes_are_traceable(self):
        jobs = self.export["EvaluationJobHistory"]
        reviews = self.export["Reviews"]
        completed_by_provider = Counter()
        for job_id, job in jobs.items():
            self.assertEqual(job_id, job["jobId"])
            self.assertEqual(self.manifest["datasetVersion"], job["datasetVersion"])
            if job["jobStatus"] == "Done":
                completed_by_provider[job["assignedTo"]] += 1
        for review_id, review in reviews.items():
            self.assertEqual(review_id, review["reviewId"])
            self.assertIn(review["jobId"], jobs)
            self.assertEqual("Done", jobs[review["jobId"]]["jobStatus"])
            self.assertEqual(review["handymanId"], jobs[review["jobId"]]["assignedTo"])
            self.assertIn(review["rating"], (3, 4, 5))
        for provider_id, provider in self.export["Handyman"].items():
            self.assertGreater(completed_by_provider[provider_id], 0)
            self.assertEqual(
                completed_by_provider[provider_id],
                len(provider["evaluationCompletedJobs"]),
            )

    def test_all_broad_and_specific_cases_return_candidates(self):
        providers = self.adapter.provider_payloads(
            self.export["Handyman"],
            self.export["EvaluationJobHistory"],
            self.export["Reviews"],
        )
        profiles = [ProviderProfile.from_dict(provider) for provider in providers]
        ranker = WeightedProviderRanker()
        decider = AutoAssignmentDecisionService()
        for case in self.cases:
            job = JobInput.from_dict(case["job"])
            category = case["categoryId"]
            triage = TriageResult(
                job_id=job.job_id,
                triage_status="READY_FOR_ASSIGNMENT",
                category_id=category,
                urgency="NORMAL",
                required_skills=(category,),
                missing_fields=(),
                confidence=0.95,
                evidence_doc_ids=(),
                reason_codes=("CATEGORY_HINT_MATCH",),
            )
            result = ranker.rank(job, triage, profiles)
            self.assertGreaterEqual(
                len(result.candidates),
                case["expectedCandidateMinimum"],
                case["caseId"],
            )
            self.assertTrue(
                all(candidate.provider_id in case["expectedRelevantProviderIds"] for candidate in result.candidates),
                case["caseId"],
            )
            decision = decider.decide(job, triage, result, profiles)
            self.assertEqual("AUTO_ASSIGN", decision.decision, case["caseId"])

    def test_manifest_counts_match_generated_records(self):
        self.assertEqual(self.manifest["providerCount"], len(self.export["Handyman"]))
        self.assertEqual(self.manifest["historyJobCount"], len(self.export["EvaluationJobHistory"]))
        self.assertEqual(self.manifest["reviewCount"], len(self.export["Reviews"]))
        self.assertEqual(self.manifest["evaluationCaseCount"], len(self.cases))


if __name__ == "__main__":
    unittest.main()
