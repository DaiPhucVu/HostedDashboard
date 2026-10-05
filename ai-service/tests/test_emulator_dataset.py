import json
import unittest
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "fixtures" / "emulator_v1"


class EmulatorDatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((DATASET / "manifest.json").read_text(encoding="utf-8"))
        cls.export = json.loads((DATASET / "firebase-export.json").read_text(encoding="utf-8"))
        cls.labels = json.loads((DATASET / "labels.json").read_text(encoding="utf-8"))

    def test_dataset_meets_language_and_size_gates(self):
        counts = Counter(label["language"] for label in self.labels)

        self.assertGreaterEqual(len(self.labels), 100)
        self.assertGreaterEqual(counts["en"], 40)
        self.assertGreaterEqual(counts["bn"], 40)
        self.assertGreaterEqual(counts["mixed"], 20)
        self.assertEqual(dict(sorted(counts.items())), self.manifest["languageCounts"])

    def test_every_service_family_has_two_complete_eligible_providers(self):
        providers_by_family = defaultdict(list)
        for provider in self.export["Handyman"].values():
            for skill in provider.get("skills", []):
                if skill in self.manifest["serviceFamilies"]:
                    providers_by_family[skill].append(provider)

        for family in self.manifest["serviceFamilies"]:
            eligible = [
                provider for provider in providers_by_family[family]
                if provider.get("verificationStatus") == "approved"
                and provider.get("available") is True
                and provider.get("latitude") is not None
                and provider.get("longitude") is not None
                and provider.get("serviceRadiusKm", 0) > 0
                and provider.get("maxConcurrentJobs", 0) > 0
            ]
            self.assertGreaterEqual(len(eligible), 2, family)

    def test_labels_reference_existing_jobs_and_related_providers(self):
        jobs = self.export["Job"]
        providers = self.export["Handyman"]
        labelled_job_ids = set()

        for label in self.labels:
            self.assertIn(label["jobId"], jobs)
            self.assertNotIn(label["jobId"], labelled_job_ids)
            labelled_job_ids.add(label["jobId"])
            self.assertEqual("REQUIRES_TWO_REVIEWERS", label["labelStatus"])
            self.assertGreaterEqual(len(label["relevantProviderIds"]), 2)
            for provider_id in label["relevantProviderIds"]:
                self.assertIn(provider_id, providers)
                self.assertIn(
                    label["expectedCategoryId"],
                    providers[provider_id]["skills"],
                )

    def test_history_and_ratings_have_traceable_job_sources(self):
        jobs = self.export["Job"]
        providers = self.export["Handyman"]
        completed_by_provider = Counter()

        for job in jobs.values():
            if job.get("jobStatus") == "Done":
                completed_by_provider[job["assignedTo"]] += 1
        for review in self.export["Reviews"].values():
            self.assertIn(review["jobId"], jobs)
            self.assertEqual("Done", jobs[review["jobId"]]["jobStatus"])
            self.assertEqual(review["handymanId"], jobs[review["jobId"]]["assignedTo"])
            self.assertEqual("customer", review["reviewerType"])

        complete_provider_ids = [
            provider_id for provider_id in providers
            if provider_id.startswith("eval-") and "negative" not in provider_id
        ]
        for provider_id in complete_provider_ids:
            self.assertGreater(completed_by_provider[provider_id], 0)


if __name__ == "__main__":
    unittest.main()
