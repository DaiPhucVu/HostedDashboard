import json
import statistics
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.domain.contracts import load_schema, validate
from app.domain.models import JobInput
from app.ranking.weighted import WeightedProviderRanker
from app.repositories.fixtures import FixtureRepository
from app.retrieval.fts5 import Fts5KnowledgeIndex
from app.triage.rules import RuleTriageService, load_taxonomy


ROOT = Path(__file__).resolve().parents[2]


def macro_f1(expected: Sequence[Optional[str]], actual: Sequence[Optional[str]]) -> float:
    labels = sorted(set(expected) | set(actual), key=lambda item: str(item))
    scores: List[float] = []
    for label in labels:
        true_positive = sum(e == label and a == label for e, a in zip(expected, actual))
        false_positive = sum(e != label and a == label for e, a in zip(expected, actual))
        false_negative = sum(e == label and a != label for e, a in zip(expected, actual))
        precision = true_positive / max(1, true_positive + false_positive)
        recall = true_positive / max(1, true_positive + false_negative)
        scores.append(0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall))
    return sum(scores) / max(1, len(scores))


def percentile_95(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round(0.95 * (len(ordered) - 1)))))
    return ordered[index]


def run() -> Dict[str, Any]:
    fixtures = FixtureRepository(ROOT / "fixtures")
    documents = fixtures.list_documents()
    providers = fixtures.list_providers()
    index = Fts5KnowledgeIndex(documents)
    triage_service = RuleTriageService(load_taxonomy(ROOT / "taxonomy/service_taxonomy.json"), index)
    ranker = WeightedProviderRanker()

    schemas = {
        "job": load_schema(ROOT / "contracts/job.schema.json"),
        "provider": load_schema(ROOT / "contracts/provider.schema.json"),
        "triage": load_schema(ROOT / "contracts/triage-result.schema.json"),
        "ranking": load_schema(ROOT / "contracts/ranking-result.schema.json"),
    }
    raw_providers = json.loads((ROOT / "fixtures/providers.json").read_text(encoding="utf-8"))
    for raw_provider in raw_providers:
        validate(raw_provider, schemas["provider"])

    expected_categories: List[Optional[str]] = []
    actual_categories: List[Optional[str]] = []
    status_matches = 0
    missing_true_positive = 0
    missing_false_positive = 0
    missing_false_negative = 0
    urgent_total = 0
    urgent_found = 0
    retrieval_recalls: List[float] = []
    ranking_recalls: List[float] = []
    hard_filter_violations = 0
    latency_ms: List[float] = []
    failures: List[Dict[str, Any]] = []

    cases = fixtures.job_cases()
    for case in cases:
        validate(case["input"], schemas["job"])
        job = JobInput.from_dict(case["input"])
        expected = case["expected"]

        started = time.perf_counter()
        triage = triage_service.triage(job)
        latency_ms.append((time.perf_counter() - started) * 1000.0)
        validate(triage.to_contract_dict(), schemas["triage"])

        expected_categories.append(expected["categoryId"])
        actual_categories.append(triage.category_id)
        status_matches += int(triage.triage_status == expected["status"])
        expected_missing = set(expected["missingFields"])
        actual_missing = set(triage.missing_fields)
        missing_true_positive += len(expected_missing & actual_missing)
        missing_false_positive += len(actual_missing - expected_missing)
        missing_false_negative += len(expected_missing - actual_missing)
        if expected["urgency"] in {"HIGH", "CRITICAL"}:
            urgent_total += 1
            urgent_found += int(triage.urgency == expected["urgency"])

        expected_docs = set(expected["evidenceDocIds"])
        if expected_docs:
            retrieval_recalls.append(len(expected_docs & set(triage.evidence_doc_ids)) / len(expected_docs))

        ranking = ranker.rank(job, triage, providers)
        validate(ranking.to_contract_dict(), schemas["ranking"])
        candidate_ids = [candidate.provider_id for candidate in ranking.candidates]
        expected_candidates = set(expected["topProviderIds"])
        if expected_candidates:
            ranking_recalls.append(len(expected_candidates & set(candidate_ids)) / len(expected_candidates))

        provider_by_id = {provider.provider_id: provider for provider in providers}
        for candidate in ranking.candidates:
            reasons = ranker._rejection_reasons(job, triage, provider_by_id[candidate.provider_id])
            hard_filter_violations += int(bool(reasons))

        mismatches = []
        if triage.category_id != expected["categoryId"]:
            mismatches.append("category")
        if triage.urgency != expected["urgency"]:
            mismatches.append("urgency")
        if triage.triage_status != expected["status"]:
            mismatches.append("status")
        if actual_missing != expected_missing:
            mismatches.append("missingFields")
        if expected_candidates and not expected_candidates.intersection(candidate_ids):
            mismatches.append("ranking")
        if mismatches:
            failures.append({
                "jobId": job.job_id,
                "mismatches": mismatches,
                "actualTriage": triage.to_contract_dict(),
                "candidateIds": candidate_ids,
            })

    missing_precision = missing_true_positive / max(1, missing_true_positive + missing_false_positive)
    missing_recall = missing_true_positive / max(1, missing_true_positive + missing_false_negative)
    missing_f1 = (
        0.0
        if missing_precision + missing_recall == 0
        else 2 * missing_precision * missing_recall / (missing_precision + missing_recall)
    )
    metrics = {
        "datasetSize": len(cases),
        "categoryMacroF1": round(macro_f1(expected_categories, actual_categories), 4),
        "statusAccuracy": round(status_matches / max(1, len(cases)), 4),
        "missingFieldF1": round(missing_f1, 4),
        "urgentDetectionRecall": round(urgent_found / max(1, urgent_total), 4),
        "retrievalRecallAt5": round(statistics.mean(retrieval_recalls), 4),
        "providerFitRecallAt5": round(statistics.mean(ranking_recalls), 4),
        "hardFilterViolations": hard_filter_violations,
        "triageLatencyP95Ms": round(percentile_95(latency_ms), 4),
    }
    result = {
        "version": "baseline-v2-priority-only",
        "metrics": metrics,
        "failures": failures,
    }
    artifact = ROOT / "artifacts/baseline.json"
    artifact.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    run()
