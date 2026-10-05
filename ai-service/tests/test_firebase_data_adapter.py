import json
import unittest
from pathlib import Path

from app.services.firebase_data_adapter import FirebaseDataAdapter


ROOT = Path(__file__).resolve().parents[1]


class FirebaseDataAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.adapter = FirebaseDataAdapter(
            ROOT / "taxonomy" / "service_taxonomy.json"
        )
        cls.data = json.loads(
            (ROOT / "fixtures" / "emulator_v1" / "firebase-export.json")
            .read_text(encoding="utf-8")
        )

    def test_builds_provider_history_from_jobs_and_customer_reviews(self):
        payloads = self.adapter.provider_payloads(
            self.data["Handyman"],
            self.data["Job"],
            self.data["Reviews"],
        )
        by_id = {item["providerId"]: item for item in payloads}
        experienced = by_id["eval-plumbing-01"]
        developing = by_id["eval-plumbing-02"]

        self.assertEqual(8, experienced["completedJobs"])
        self.assertEqual(8, experienced["completedJobsByCategory"]["plumbing"])
        self.assertEqual(8, experienced["reviewCount"])
        self.assertEqual(0, experienced["activeJobs"])
        self.assertEqual(3, developing["completedJobs"])
        self.assertEqual(1, developing["activeJobs"])
        self.assertIn("plumbing", experienced["skills"])
        self.assertTrue(experienced["availabilityRecorded"])
        self.assertTrue(experienced["capacityRecorded"])

    def test_maps_every_app_category_to_its_service_family(self):
        for label in self.data["Job"].values():
            if not str(label.get("jobId", "")).startswith("case-"):
                continue
            category = self.adapter.canonical_category(label)
            self.assertIsNotNone(category, label.get("jobCat"))

    def test_uses_the_system_workload_limit_instead_of_profile_capacity(self):
        providers = {
            "provider": {
                "handymanId": "provider",
                "verified": True,
                "available": True,
                "maxConcurrentJobs": 99,
            }
        }
        payload = self.adapter.provider_payloads(providers, {}, {})[0]

        self.assertEqual(3, payload["maxConcurrentJobs"])
        self.assertTrue(payload["capacityRecorded"])
        self.assertTrue(payload["availabilityRecorded"])

    def test_job_payload_preserves_recorded_assignment_inputs(self):
        raw = self.data["Job"]["case-plumbing-02"]
        payload = self.adapter.job_payload("case-plumbing-02", raw)

        self.assertEqual("plumbing", payload["categoryHint"])
        self.assertEqual(23.7925, payload["latitude"])
        self.assertEqual("Gulshan, Dhaka", payload["locationText"])
        self.assertTrue(payload["startAt"])


if __name__ == "__main__":
    unittest.main()
