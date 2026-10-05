import unittest
from dataclasses import replace

from app.domain.models import JobInput, ProviderProfile, TriageResult
from app.ranking.weighted import CATEGORY_JOBS_CAP, WeightedProviderRanker


class RankingV2Tests(unittest.TestCase):
    def setUp(self):
        self.job = JobInput(
            job_id="plumbing-v2",
            description="Urgent leaking kitchen pipe",
            category_hint="plumbing",
            location_text="Dhaka",
            latitude=23.7806,
            longitude=90.4070,
        )
        self.triage = TriageResult(
            job_id=self.job.job_id,
            triage_status="READY_FOR_ASSIGNMENT",
            category_id="plumbing",
            urgency="HIGH",
            required_skills=("plumbing",),
            missing_fields=(),
            confidence=0.95,
            evidence_doc_ids=("policy-plumbing",),
            reason_codes=("TEST",),
            extracted_issues=("leaking pipe",),
        )
        self.ranker = WeightedProviderRanker()

    def provider(
        self,
        provider_id,
        *,
        skills=("plumbing",),
        years=0,
        category_jobs=0,
        completed=0,
        cancelled=0,
        rating=0,
        reviews=0,
        active=0,
        latitude=23.7806,
    ):
        return ProviderProfile(
            provider_id=provider_id,
            display_name=provider_id,
            verified=True,
            skills=skills,
            languages=("en",),
            available=True,
            latitude=latitude,
            longitude=90.4070,
            service_radius_km=20,
            active_jobs=active,
            max_concurrent_jobs=3,
            average_rating=rating,
            review_count=reviews,
            completion_rate=0,
            cancellation_rate=0,
            median_response_minutes=0,
            years_experience=years,
            years_experience_recorded=True,
            completed_jobs=completed,
            completed_jobs_by_category={"plumbing": category_jobs},
            provider_cancelled_jobs=cancelled,
        )

    def test_real_experience_and_history_change_candidate_order(self):
        experienced = self.provider(
            "experienced",
            years=15,
            category_jobs=50,
            completed=50,
            cancelled=2,
            rating=4.8,
            reviews=42,
        )
        junior = self.provider(
            "junior",
            years=3,
            category_jobs=7,
            completed=7,
            cancelled=1,
            rating=4.7,
            reviews=8,
            active=1,
        )
        unrelated = self.provider(
            "unrelated",
            skills=("electrical",),
            years=20,
            category_jobs=100,
            completed=100,
            rating=4.9,
            reviews=80,
        )

        result = self.ranker.rank(
            self.job,
            self.triage,
            [junior, unrelated, experienced],
        )

        self.assertEqual(
            ("experienced", "junior"),
            tuple(candidate.provider_id for candidate in result.candidates),
        )
        self.assertEqual(
            ("MISSING_REQUIRED_SKILL",),
            result.rejected[0].reason_codes,
        )
        self.assertGreater(
            result.candidates[0].score_breakdown["relevantExperience"],
            result.candidates[1].score_breakdown["relevantExperience"],
        )

    def test_cold_start_uses_labelled_neutral_priors_instead_of_zero_history(self):
        provider = self.provider("new-provider", years=8)

        candidate = self.ranker.rank(
            self.job,
            self.triage,
            [provider],
        ).candidates[0]

        self.assertEqual(0.6, candidate.score_breakdown["rating"])
        self.assertEqual(0.7, candidate.score_breakdown["reliability"])
        self.assertIn("RATING_NEUTRAL_PRIOR", candidate.reason_codes)
        self.assertIn("RELIABILITY_NEUTRAL_PRIOR", candidate.reason_codes)
        self.assertTrue(candidate.evidence["rating"]["usedNeutralPrior"])
        self.assertEqual(0, candidate.evidence["categoryExperience"]["completedJobs"])

    def test_more_provider_cancellations_reduce_reliability(self):
        stable = self.provider(
            "stable",
            years=5,
            category_jobs=20,
            completed=20,
            cancelled=1,
        )
        unreliable = replace(stable, provider_id="unreliable", provider_cancelled_jobs=10)

        result = self.ranker.rank(self.job, self.triage, [unreliable, stable])
        by_id = {item.provider_id: item for item in result.candidates}

        self.assertGreater(
            by_id["stable"].score_breakdown["reliability"],
            by_id["unreliable"].score_breakdown["reliability"],
        )
        self.assertGreater(by_id["stable"].total_score, by_id["unreliable"].total_score)

    def test_increasing_relevant_experience_never_reduces_score(self):
        baseline = self.provider("baseline", years=2, category_jobs=2, completed=2)
        stronger = replace(
            baseline,
            provider_id="stronger",
            years_experience=10,
            completed_jobs=20,
            completed_jobs_by_category={"plumbing": 20},
        )
        result = self.ranker.rank(self.job, self.triage, [baseline, stronger])
        by_id = {item.provider_id: item for item in result.candidates}

        self.assertGreater(
            by_id["stronger"].score_breakdown["relevantExperience"],
            by_id["baseline"].score_breakdown["relevantExperience"],
        )
        self.assertGreater(by_id["stronger"].total_score, by_id["baseline"].total_score)

    def test_same_category_history_is_capped_at_twenty_jobs(self):
        at_cap = self.provider(
            "at-cap",
            years=5,
            category_jobs=20,
            completed=20,
        )
        above_cap = replace(
            at_cap,
            provider_id="above-cap",
            completed_jobs=50,
            completed_jobs_by_category={"plumbing": 50},
        )
        result = self.ranker.rank(self.job, self.triage, [at_cap, above_cap])
        by_id = {item.provider_id: item for item in result.candidates}

        self.assertEqual(20, CATEGORY_JOBS_CAP)
        self.assertEqual(
            by_id["at-cap"].score_breakdown["relevantExperience"],
            by_id["above-cap"].score_breakdown["relevantExperience"],
        )

    def test_same_category_history_is_family_evidence_when_profile_skills_are_missing(self):
        history_backed = self.provider(
            "history-backed",
            skills=(),
            category_jobs=4,
            completed=4,
        )

        result = self.ranker.rank(self.job, self.triage, [history_backed])

        self.assertEqual("history-backed", result.candidates[0].provider_id)
        self.assertEqual(0.7, result.candidates[0].score_breakdown["skillMatch"])

    def test_policy_defaults_are_exposed_as_evidence(self):
        provider = replace(
            self.provider("legacy-provider"),
            location_source="POLICY_DEFAULT_COORDINATES",
            service_radius_recorded=False,
            availability_recorded=False,
            capacity_recorded=False,
        )

        evidence = self.ranker.rank(
            self.job,
            self.triage,
            [provider],
        ).candidates[0].evidence

        self.assertEqual(
            "POLICY_DEFAULT_COORDINATES",
            evidence["distance"]["providerLocationSource"],
        )
        self.assertFalse(evidence["distance"]["serviceRadiusRecorded"])
        self.assertFalse(evidence["availability"]["availabilityRecorded"])
        self.assertFalse(evidence["availability"]["capacityRecorded"])

    def test_platform_history_beats_invalid_declared_experience_and_missing_defaults(self):
        unsupported_claim = replace(
            self.provider("unsupported-claim", years=70),
            years_experience_recorded=True,
            location_source="POLICY_DEFAULT_COORDINATES",
            service_radius_recorded=False,
            availability_recorded=False,
            capacity_recorded=False,
        )
        platform_history = replace(
            self.provider(
                "platform-history",
                years=24,
                category_jobs=6,
                completed=7,
                active=2,
            ),
            years_experience_recorded=True,
            location_source="POLICY_DEFAULT_COORDINATES",
            service_radius_recorded=False,
            availability_recorded=False,
            capacity_recorded=False,
        )

        result = self.ranker.rank(
            self.job,
            self.triage,
            [unsupported_claim, platform_history],
        )
        by_id = {candidate.provider_id: candidate for candidate in result.candidates}

        self.assertEqual("platform-history", result.candidates[0].provider_id)
        self.assertFalse(
            by_id["unsupported-claim"].evidence["profileExperience"]["valid"]
        )
        self.assertGreater(
            by_id["unsupported-claim"].score_breakdown["availability"],
            by_id["platform-history"].score_breakdown["availability"],
        )
        self.assertEqual(
            by_id["unsupported-claim"].score_breakdown["distance"],
            by_id["platform-history"].score_breakdown["distance"],
        )

    def test_missing_capacity_uses_active_job_count_for_workload_score(self):
        idle = replace(
            self.provider("idle", active=0),
            availability_recorded=False,
            capacity_recorded=False,
        )
        busy = replace(
            self.provider("busy", active=2),
            availability_recorded=False,
            capacity_recorded=False,
        )

        result = self.ranker.rank(self.job, self.triage, [idle, busy])

        by_id = {candidate.provider_id: candidate for candidate in result.candidates}

        self.assertEqual(1.0, by_id["idle"].score_breakdown["availability"])
        self.assertEqual(0.6, by_id["busy"].score_breakdown["availability"])
        self.assertEqual(
            "ACTIVE_JOB_COUNT",
            by_id["busy"].evidence["availability"]["scoringMethod"],
        )


if __name__ == "__main__":
    unittest.main()
