import unittest
from dataclasses import replace
from pathlib import Path

from app.domain.models import JobInput, ProviderProfile, TriageResult
from app.ranking.weighted import WeightedProviderRanker
from app.repositories.fixtures import FixtureRepository


ROOT = Path(__file__).resolve().parents[1]


class RankingTests(unittest.TestCase):
    def setUp(self):
        self.providers = FixtureRepository(ROOT / "fixtures").list_providers()
        self.ranker = WeightedProviderRanker()
        self.job = JobInput(
            job_id="plumbing",
            description="Kitchen pipe leak",
            location_text="Dhaka",
            latitude=23.7806,
            longitude=90.4070,
            start_at="2026-09-01T10:00:00+06:00",
        )
        self.triage = TriageResult(
            job_id="plumbing",
            triage_status="READY_FOR_ASSIGNMENT",
            category_id="plumbing",
            urgency="NORMAL",
            required_skills=("plumbing",),
            missing_fields=(),
            confidence=0.9,
            evidence_doc_ids=("policy-plumbing",),
            reason_codes=("TEST",),
        )

    def test_ineligible_providers_never_rank(self):
        result = self.ranker.rank(self.job, self.triage, self.providers)
        candidate_ids = {candidate.provider_id for candidate in result.candidates}
        self.assertNotIn("provider-plumbing-unverified", candidate_ids)
        self.assertNotIn("provider-plumbing-far", candidate_ids)
        self.assertNotIn("provider-multiskill-overloaded", candidate_ids)

    def test_ranking_is_deterministic(self):
        first = self.ranker.rank(self.job, self.triage, self.providers).to_contract_dict()
        second = self.ranker.rank(self.job, self.triage, self.providers).to_contract_dict()
        self.assertEqual(first, second)

    def test_incomplete_job_gets_provisional_candidates_without_relaxing_hard_filters(self):
        incomplete = replace(
            self.triage,
            triage_status="NEEDS_INFO",
            missing_fields=("description",),
        )
        result = self.ranker.rank(self.job, incomplete, self.providers)
        self.assertGreater(len(result.candidates), 0)
        self.assertTrue(all(
            "PROVISIONAL_MISSING_INFORMATION" in candidate.reason_codes
            for candidate in result.candidates
        ))
        candidate_ids = {candidate.provider_id for candidate in result.candidates}
        self.assertNotIn("provider-plumbing-unverified", candidate_ids)
        self.assertNotIn("provider-plumbing-far", candidate_ids)

    def test_manual_review_does_not_rank(self):
        manual = replace(self.triage, triage_status="MANUAL_REVIEW", confidence=0.4)
        result = self.ranker.rank(self.job, manual, self.providers)
        self.assertEqual((), result.candidates)

    def test_distance_only_failures_are_separate_non_assignable_alternatives(self):
        distant = next(provider for provider in self.providers if provider.provider_id == "provider-plumbing-far")
        unverified = next(
            provider for provider in self.providers
            if provider.provider_id == "provider-plumbing-unverified"
        )
        result = self.ranker.rank(self.job, self.triage, [distant, unverified])
        self.assertEqual((), result.candidates)
        self.assertEqual((distant.provider_id,), tuple(item.provider_id for item in result.alternatives))
        self.assertIn("DISTANCE_REQUIREMENT_RELAXED", result.alternatives[0].reason_codes)
        self.assertNotIn(unverified.provider_id, {item.provider_id for item in result.alternatives})

    def test_missing_location_can_preview_skilled_eligible_provider(self):
        no_location_job = replace(self.job, latitude=None, longitude=None)
        result = self.ranker.rank(no_location_job, self.triage, self.providers)
        self.assertEqual((), result.candidates)
        self.assertGreater(len(result.alternatives), 0)
        self.assertTrue(all(
            "JOB_LOCATION_MISSING" in item.reason_codes
            for item in result.alternatives
        ))

    def _provider(self, provider_id, skills):
        return ProviderProfile(
            provider_id=provider_id,
            display_name=provider_id,
            verified=True,
            skills=skills,
            languages=("en",),
            available=True,
            latitude=23.7806,
            longitude=90.4070,
            service_radius_km=20,
            active_jobs=0,
            max_concurrent_jobs=3,
            average_rating=4.5,
            review_count=10,
            completion_rate=0.95,
            cancellation_rate=0.02,
            median_response_minutes=20,
        )

    def test_specialty_provider_is_eligible_for_a_broad_category_request(self):
        broad_job = replace(
            self.job,
            job_id="beauty-broad",
            description="I need a beauty and wellness service",
            category_hint="beauty_wellness",
        )
        broad_triage = replace(
            self.triage,
            job_id="beauty-broad",
            category_id="beauty_wellness",
            required_skills=("beauty_wellness",),
        )
        facial_provider = self._provider("facial-provider", ("facial",))

        result = self.ranker.rank(broad_job, broad_triage, [facial_provider])

        self.assertEqual(("facial-provider",), tuple(
            candidate.provider_id for candidate in result.candidates
        ))
        self.assertEqual(0.8, result.candidates[0].score_breakdown["skillMatch"])

    def test_explicit_specialty_match_ranks_above_general_category_match(self):
        facial_job = replace(
            self.job,
            job_id="beauty-facial",
            description="I need a facial treatment",
            category_hint="beauty_wellness",
        )
        facial_triage = replace(
            self.triage,
            job_id="beauty-facial",
            category_id="beauty_wellness",
            required_skills=("beauty_wellness",),
        )
        general_provider = self._provider("general-provider", ("beauty_wellness",))
        facial_provider = self._provider("facial-provider", ("facial",))

        result = self.ranker.rank(
            facial_job,
            facial_triage,
            [general_provider, facial_provider],
        )

        self.assertEqual("facial-provider", result.candidates[0].provider_id)
        self.assertEqual(1.0, result.candidates[0].score_breakdown["skillMatch"])
        self.assertEqual(0.8, result.candidates[1].score_breakdown["skillMatch"])

    def test_unrelated_category_provider_remains_ineligible(self):
        broad_job = replace(
            self.job,
            job_id="beauty-unrelated",
            description="I need a beauty service",
        )
        broad_triage = replace(
            self.triage,
            job_id="beauty-unrelated",
            category_id="beauty_wellness",
            required_skills=("beauty_wellness",),
        )
        plumber = self._provider("plumber", ("plumbing",))

        result = self.ranker.rank(broad_job, broad_triage, [plumber])

        self.assertEqual((), result.candidates)
        self.assertEqual(("MISSING_REQUIRED_SKILL",), result.rejected[0].reason_codes)

    def test_every_service_family_accepts_a_related_specialty_provider(self):
        specialties = {
            "plumbing": "pipe_fitting",
            "electrical": "wiring",
            "cleaning": "deep_cleaning",
            "appliance_repair": "fridge_repair",
            "painting": "renovation",
            "ac_repair": "hvac",
            "beauty_wellness": "facial",
            "shifting": "packing",
            "mens_care_salon": "barber",
            "health_care": "nursing",
            "electronics_repair": "phone_repair",
            "pest_control": "termite_control",
            "driver_service": "chauffeur",
            "car_care": "car_wash",
            "trips_travel": "tour_guide",
            "car_rental": "vehicle_rental",
            "emergency_service": "emergency_response",
        }

        for category, specialty in specialties.items():
            with self.subTest(category=category):
                job = replace(
                    self.job,
                    job_id="broad-{}".format(category),
                    description="I need help with this service",
                    category_hint=category,
                )
                triage = replace(
                    self.triage,
                    job_id=job.job_id,
                    category_id=category,
                    required_skills=(category,),
                )
                provider = self._provider("provider-{}".format(category), (specialty,))

                result = self.ranker.rank(job, triage, [provider])

                self.assertEqual(1, len(result.candidates))
