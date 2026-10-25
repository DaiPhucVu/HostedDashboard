import json
import unittest
from pathlib import Path

from app.domain.models import JobInput, ProviderProfile, TriageResult
from app.ranking.weighted import WeightedProviderRanker


ROOT = Path(__file__).resolve().parents[1]


class RankingV2GoldenFixtureTests(unittest.TestCase):
    def test_golden_plumbing_case(self):
        fixture = json.loads(
            (ROOT / "fixtures/ranking_v2/golden_plumbing.json").read_text(encoding="utf-8")
        )
        job = JobInput.from_dict(fixture["job"])
        raw_triage = fixture["triage"]
        triage = TriageResult(
            job_id=raw_triage["jobId"],
            triage_status=raw_triage["triageStatus"],
            category_id=raw_triage["categoryId"],
            urgency=raw_triage["urgency"],
            required_skills=tuple(raw_triage["requiredSkills"]),
            missing_fields=tuple(raw_triage["missingFields"]),
            confidence=raw_triage["confidence"],
            evidence_doc_ids=tuple(raw_triage["evidenceDocIds"]),
            reason_codes=tuple(raw_triage["reasonCodes"]),
            extracted_issues=tuple(raw_triage["extractedIssues"]),
        )
        providers = [ProviderProfile.from_dict(item) for item in fixture["providers"]]

        result = WeightedProviderRanker().rank(job, triage, providers)

        self.assertEqual(
            fixture["expected"]["candidateOrder"],
            [item.provider_id for item in result.candidates],
        )
        self.assertEqual(
            fixture["expected"]["rejected"],
            {item.provider_id: list(item.reason_codes) for item in result.rejected},
        )
        self.assertTrue(
            result.candidates[-1].evidence["rating"]["usedNeutralPrior"]
        )
        self.assertGreater(
            result.candidates[0].score_breakdown["relevantExperience"],
            result.candidates[1].score_breakdown["relevantExperience"],
        )


if __name__ == "__main__":
    unittest.main()
