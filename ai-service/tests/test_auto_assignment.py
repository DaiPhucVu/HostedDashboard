import unittest
from dataclasses import replace

from app.domain.models import (
    CandidateScore,
    JobInput,
    ProviderProfile,
    RankingResult,
    TriageResult,
)
from app.services.auto_assignment import (
    AutoAssignmentDecisionService,
    AutoAssignmentPolicy,
)


class AutoAssignmentDecisionTests(unittest.TestCase):
    def setUp(self):
        self.job = JobInput(
            job_id="job-auto",
            description="Need plumbing help",
            category_hint="plumbing",
            location_text="Gulshan",
            latitude=23.79,
            longitude=90.41,
            start_at="2026-10-10",
        )
        self.triage = TriageResult(
            job_id=self.job.job_id,
            triage_status="READY_FOR_ASSIGNMENT",
            category_id="plumbing",
            urgency="NORMAL",
            required_skills=("plumbing",),
            missing_fields=("description",),
            confidence=0.9,
            evidence_doc_ids=("plumbing-policy",),
            reason_codes=("CATEGORY_HINT_USED",),
        )
        self.provider = ProviderProfile(
            provider_id="provider-1",
            display_name="Provider One",
            verified=True,
            skills=("plumbing",),
            languages=("en",),
            available=True,
            latitude=23.79,
            longitude=90.41,
            service_radius_km=20,
            active_jobs=0,
            max_concurrent_jobs=3,
            average_rating=4.8,
            review_count=12,
            completion_rate=0.95,
            cancellation_rate=0.05,
            median_response_minutes=15,
            completed_jobs=10,
            completed_jobs_by_category={"plumbing": 8},
            provider_cancelled_jobs=1,
        )
        self.service = AutoAssignmentDecisionService(
            AutoAssignmentPolicy(minimum_score=0.60, minimum_margin=0.0)
        )

    @staticmethod
    def candidate(provider_id, score, rank=1):
        return CandidateScore(
            provider_id=provider_id,
            rank=rank,
            total_score=score,
            score_breakdown={},
            reason_codes=(),
        )

    def ranking(self, *candidates):
        return RankingResult(
            job_id=self.job.job_id,
            ranking_version="ranking-test",
            candidates=tuple(candidates),
        )

    def test_complete_clear_top_candidate_is_auto_assignable(self):
        decision = self.service.decide(
            self.job,
            self.triage,
            self.ranking(
                self.candidate("provider-1", 0.82),
                self.candidate("provider-2", 0.74, 2),
            ),
            [self.provider],
        )

        self.assertEqual("AUTO_ASSIGN", decision.decision)
        self.assertEqual("provider-1", decision.provider_id)
        self.assertEqual(0.08, decision.score_margin)

    def test_broad_description_does_not_block_a_valid_category(self):
        decision = self.service.decide(
            self.job,
            self.triage,
            self.ranking(self.candidate("provider-1", 0.82)),
            [self.provider],
        )

        self.assertEqual("AUTO_ASSIGN", decision.decision)

    def test_category_and_description_conflict_requires_manual_review(self):
        conflicting_triage = replace(
            self.triage,
            reason_codes=(
                *self.triage.reason_codes,
                "CATEGORY_SEMANTIC_CONFLICT",
            ),
        )

        decision = self.service.decide(
            self.job,
            conflicting_triage,
            self.ranking(self.candidate("provider-1", 0.82)),
            [self.provider],
        )

        self.assertEqual("MANUAL_REVIEW", decision.decision)
        self.assertIn("CATEGORY_SEMANTIC_CONFLICT", decision.reason_codes)

    def test_missing_optional_provider_evidence_does_not_block_a_ranked_candidate(self):
        incomplete = replace(
            self.provider,
            availability_recorded=False,
            capacity_recorded=False,
            location_source="POLICY_DEFAULT_COORDINATES",
            service_radius_recorded=False,
        )
        decision = self.service.decide(
            self.job,
            self.triage,
            self.ranking(self.candidate("provider-1", 0.82)),
            [incomplete],
        )

        self.assertEqual("AUTO_ASSIGN", decision.decision)

    def test_close_candidates_do_not_block_the_top_ranked_provider(self):
        second = replace(self.provider, provider_id="provider-2")
        decision = self.service.decide(
            self.job,
            self.triage,
            self.ranking(
                self.candidate("provider-1", 0.82),
                self.candidate("provider-2", 0.80, 2),
            ),
            [self.provider, second],
        )

        self.assertEqual("AUTO_ASSIGN", decision.decision)
        self.assertEqual("provider-1", decision.provider_id)

    def test_missing_category_history_does_not_block_a_ranked_candidate(self):
        no_history = replace(
            self.provider,
            completed_jobs_by_category={},
        )
        decision = self.service.decide(
            self.job,
            self.triage,
            self.ranking(self.candidate("provider-1", 0.82)),
            [no_history],
        )

        self.assertEqual("AUTO_ASSIGN", decision.decision)

    def test_score_must_be_strictly_above_sixty_percent(self):
        at_threshold = self.service.decide(
            self.job,
            self.triage,
            self.ranking(self.candidate("provider-1", 0.60)),
            [self.provider],
        )
        above_threshold = self.service.decide(
            self.job,
            self.triage,
            self.ranking(self.candidate("provider-1", 0.61)),
            [self.provider],
        )

        self.assertEqual("MANUAL_REVIEW", at_threshold.decision)
        self.assertIn("TOP_SCORE_BELOW_THRESHOLD", at_threshold.reason_codes)
        self.assertEqual("AUTO_ASSIGN", above_threshold.decision)


if __name__ == "__main__":
    unittest.main()
