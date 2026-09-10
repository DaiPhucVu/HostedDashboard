import unittest
from pathlib import Path

from app.domain.models import JobInput
from app.repositories.fixtures import FixtureRepository
from app.retrieval.fts5 import Fts5KnowledgeIndex
from app.triage.rules import RuleTriageService, load_taxonomy


ROOT = Path(__file__).resolve().parents[1]


class TriageTests(unittest.TestCase):
    def setUp(self):
        fixtures = FixtureRepository(ROOT / "fixtures")
        self.service = RuleTriageService(
            load_taxonomy(ROOT / "taxonomy/service_taxonomy.json"),
            Fts5KnowledgeIndex(fixtures.list_documents()),
        )

    def test_critical_electrical_job_is_prioritised_without_blocking(self):
        job = JobInput(
            job_id="critical",
            description="Smoke and sparking from an electrical socket",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
            start_at="2026-09-01T08:00:00+06:00",
        )
        result = self.service.triage(job)
        self.assertEqual("electrical", result.category_id)
        self.assertEqual("CRITICAL", result.urgency)
        self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
        self.assertIn("URGENCY_RULE_MATCH", result.reason_codes)

    def test_missing_schedule_requests_more_information(self):
        job = JobInput(
            job_id="incomplete",
            description="Need deep cleaning for my apartment",
            location_text="Dhaka",
            latitude=23.78,
            longitude=90.40,
        )
        result = self.service.triage(job)
        self.assertEqual("NEEDS_INFO", result.triage_status)
        self.assertIn("schedule", result.missing_fields)

    def test_every_known_category_can_recommend_from_a_vague_description(self):
        for category in self.service.taxonomy["categories"]:
            with self.subTest(category_id=category["id"]):
                result = self.service.triage(JobInput(
                    job_id="vague-{}".format(category["id"]),
                    description="help",
                    category_hint=category["id"],
                    location_text="Dhaka",
                    latitude=23.78,
                    longitude=90.40,
                    start_at="2026-09-10T10:00:00+06:00",
                ))
                self.assertEqual(category["id"], result.category_id)
                self.assertEqual(tuple(category["requiredSkills"]), result.required_skills)
                self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
                self.assertIn("description", result.missing_fields)
                self.assertIn("LIMITED_DESCRIPTION_NON_BLOCKING", result.reason_codes)

    def test_every_additional_mobile_service_category_has_grounded_triage(self):
        cases = {
            "ac_repair": "The air conditioner is not cooling and needs AC repair",
            "beauty_wellness": "Need a makeup and facial beauty service at home",
            "shifting": "Need packing and house moving for my furniture",
            "mens_care_salon": "Need a barber for a men's haircut and shaving",
            "health_care": "Need a caregiver for elderly patient care at home",
            "electronics_repair": "My laptop needs electronics repair",
            "pest_control": "Need pest control for cockroaches and rodents",
            "driver_service": "Need to hire a personal driver for the day",
            "car_care": "Need a car wash and vehicle service",
            "trips_travel": "Need travel planning and a tour guide",
            "car_rental": "I want to rent a car for two days",
            "emergency_service": "Need immediate emergency help at home",
        }
        for category_id, description in cases.items():
            with self.subTest(category_id=category_id):
                result = self.service.triage(JobInput(
                    job_id="mobile-{}".format(category_id),
                    description=description,
                    location_text="Dhaka",
                    latitude=23.78,
                    longitude=90.40,
                    start_at="2026-09-10T10:00:00+06:00",
                ))
                self.assertEqual(category_id, result.category_id)
                self.assertEqual("READY_FOR_ASSIGNMENT", result.triage_status)
                self.assertTrue(result.evidence_doc_ids)
                self.assertIn("policy-{}".format(category_id.replace("_", "-")), result.evidence_doc_ids)
