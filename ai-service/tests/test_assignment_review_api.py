import json
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.api.server import make_handler
from app.services.assignment_review import AssignmentReviewService


VALID_JOB = {
    "jobId": "job-api-plumbing",
    "description": "Kitchen pipe is leaking and needs plumbing repair",
    "categoryHint": "Plumbing",
    "languageHint": "en",
    "locationText": "Dhanmondi",
    "latitude": 23.7461,
    "longitude": 90.3742,
    "startAt": "2026-09-01T10:00:00+06:00",
    "endAt": None,
    "budgetMin": 500,
    "budgetMax": 1500,
}


class ApplianceSemanticClient:
    model = "test-qwen"
    provider = "test"

    def generate(self, job, evidence, taxonomy):
        return {
            "category_id": "appliance_repair",
            "urgency": "NORMAL",
            "required_skills": ["appliance_repair"],
            "description_complete": True,
            "missing_information": [],
            "issue_summary": "Washing machine is leaking.",
            "extracted_issues": ["washing machine", "leaking"],
            "language": "en",
            "safety_flags": [],
            "reason_codes": ["WASHING_MACHINE"],
            "confidence": 0.92,
        }


class AssignmentReviewServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = AssignmentReviewService()

    def test_ready_job_returns_real_ranked_dashboard_providers(self):
        review = self.service.review(VALID_JOB)
        self.assertEqual(review["source"], "LOCAL_SERVICE")
        self.assertEqual(review["triage"]["triageStatus"], "READY_FOR_ASSIGNMENT")
        self.assertEqual(review["ranking"]["candidates"][0]["providerId"], "11111111-1111-1111-1111-111111111111")
        self.assertEqual(len(review["ranking"]["candidates"]), 5)
        self.assertIn(review["autoAssignment"]["decision"], {"AUTO_ASSIGN", "MANUAL_REVIEW"})

    def test_critical_job_is_prioritised_and_returns_eligible_candidates(self):
        job = dict(VALID_JOB, description="Smoke and sparking from an electrical socket", categoryHint="Electrical")
        review = self.service.review(job)
        self.assertEqual(review["triage"]["triageStatus"], "READY_FOR_ASSIGNMENT")
        self.assertEqual(review["triage"]["urgency"], "CRITICAL")
        self.assertEqual(len(review["ranking"]["candidates"]), 5)

    def test_dashboard_provider_payload_is_used_for_ranking(self):
        provider = {
            "providerId": "firebase-provider-1",
            "displayName": "Firebase Provider",
            "verified": True,
            "skills": ["plumbing"],
            "languages": ["bn", "en"],
            "available": True,
            "latitude": 23.7465,
            "longitude": 90.376,
            "serviceRadiusKm": 15,
            "activeJobs": 0,
            "maxConcurrentJobs": 3,
            "averageRating": 4.7,
            "reviewCount": 10,
            "completionRate": 0.95,
            "cancellationRate": 0.02,
            "medianResponseMinutes": 18,
        }
        review = self.service.review(VALID_JOB, [provider])
        self.assertEqual(
            [item["providerId"] for item in review["ranking"]["candidates"]],
            ["firebase-provider-1"],
        )

    def test_controlled_override_reranks_and_auto_assigns_the_right_family(self):
        service = AssignmentReviewService(semantic_client=ApplianceSemanticClient())
        job = dict(
            VALID_JOB,
            jobId="wrong-category-job",
            categoryHint="ac_repair",
            description="Washing machine is leaking",
        )

        def provider(provider_id, skill):
            return {
                "providerId": provider_id,
                "displayName": provider_id,
                "verified": True,
                "skills": [skill],
                "languages": ["en"],
                "available": True,
                "latitude": 23.7461,
                "longitude": 90.3742,
                "serviceRadiusKm": 20,
                "activeJobs": 0,
                "maxConcurrentJobs": 3,
                "averageRating": 4.8,
                "reviewCount": 20,
                "completionRate": 1,
                "cancellationRate": 0,
                "medianResponseMinutes": 10,
                "yearsExperience": 8,
                "completedJobs": 20,
                "completedJobsByCategory": {skill: 20},
                "providerCancelledJobs": 0,
            }

        review = service.review(job, [
            provider("ac-provider", "ac_repair"),
            provider("appliance-provider", "appliance_repair"),
        ])

        self.assertEqual("ac_repair", review["triage"]["originalCategory"])
        self.assertEqual("appliance_repair", review["triage"]["semanticCategory"])
        self.assertEqual("appliance_repair", review["triage"]["finalCategory"])
        self.assertEqual("SEMANTIC_OVERRIDE", review["triage"]["categoryDecision"])
        self.assertEqual(
            ["appliance-provider"],
            [item["providerId"] for item in review["ranking"]["candidates"]],
        )
        self.assertEqual("AUTO_ASSIGN", review["autoAssignment"]["decision"])


class AssignmentReviewHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        service = AssignmentReviewService()
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            make_handler(service, "http://127.0.0.1:3000,http://localhost:3007"),
        )
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = "http://127.0.0.1:{}".format(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)
        cls.server.server_close()

    def post(self, payload, path="/v1/assignment-reviews"):
        return urlopen(Request(
            self.base_url + path,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        ))

    def test_http_endpoint_returns_contract_review_and_cors(self):
        with self.post(VALID_JOB) as response:
            payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:3000")
            self.assertEqual(payload["triage"]["jobId"], VALID_JOB["jobId"])

    def test_cors_allows_each_configured_dashboard_origin(self):
        request = Request(
            self.base_url + "/health",
            headers={"Origin": "http://localhost:3007"},
        )
        with urlopen(request) as response:
            self.assertEqual(
                "http://localhost:3007",
                response.headers["Access-Control-Allow-Origin"],
            )

    def test_cors_does_not_echo_an_unconfigured_origin(self):
        request = Request(
            self.base_url + "/health",
            headers={"Origin": "https://untrusted.example"},
        )
        with urlopen(request) as response:
            self.assertIsNone(response.headers["Access-Control-Allow-Origin"])

    def test_http_endpoint_accepts_dashboard_job_and_provider_envelope(self):
        provider = {
            "providerId": "firebase-provider-2",
            "displayName": "Firebase Provider",
            "verified": True,
            "skills": ["plumbing"],
            "languages": ["bn", "en"],
            "available": True,
            "latitude": 23.7465,
            "longitude": 90.376,
            "serviceRadiusKm": 15,
            "activeJobs": 0,
            "maxConcurrentJobs": 3,
            "averageRating": 4.5,
            "reviewCount": 5,
            "completionRate": 0.9,
            "cancellationRate": 0.05,
            "medianResponseMinutes": 30,
        }
        with self.post({"job": VALID_JOB, "providers": [provider]}) as response:
            payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(payload["ranking"]["candidates"][0]["providerId"], "firebase-provider-2")

    def test_health_exposes_non_secret_semantic_runtime_selection(self):
        with urlopen(self.base_url + "/health") as response:
            payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual("ollama", payload["semanticProvider"])
        self.assertEqual("qwen3:8b", payload["semanticModel"])
        self.assertNotIn("token", json.dumps(payload).lower())

    def test_http_endpoint_rejects_unknown_contract_fields(self):
        with self.assertRaises(HTTPError) as raised:
            self.post(dict(VALID_JOB, unexpected=True))
        self.assertEqual(raised.exception.code, 422)

    def test_concurrent_local_reviews_are_deterministic(self):
        def request_candidate_ids(_):
            with self.post(VALID_JOB) as response:
                payload = json.loads(response.read().decode("utf-8"))
                return [item["providerId"] for item in payload["ranking"]["candidates"]]

        # Keep socket usage low.
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(request_candidate_ids, range(20)))
        self.assertTrue(results)
        self.assertTrue(all(result == results[0] for result in results))

    def test_assignment_endpoint_is_idempotent(self):
        job = dict(VALID_JOB, jobId="job-http-idempotent")
        with self.post(job):
            pass
        command = {
            "jobId": job["jobId"],
            "providerId": "11111111-1111-1111-1111-111111111111",
            "actorId": "admin-1",
            "expectedJobVersion": 0,
            "idempotencyKey": "job-http-idempotent-key",
            "rankingVersion": "weighted-v1",
            "selectedRank": 1,
            "overrideReason": None,
        }
        with self.post(command, "/v1/assignments") as response:
            first = json.loads(response.read().decode("utf-8"))
        with self.post(command, "/v1/assignments") as response:
            second = json.loads(response.read().decode("utf-8"))
        self.assertEqual(first, second)
        self.assertEqual(first["status"], "OFFERED")

    def test_offered_assignment_can_be_cancelled(self):
        job = dict(VALID_JOB, jobId="job-http-cancel")
        with self.post(job):
            pass
        command = {
            "jobId": job["jobId"],
            "providerId": "11111111-1111-1111-1111-111111111111",
            "actorId": "admin-1",
            "expectedJobVersion": 0,
            "idempotencyKey": "job-http-cancel-key",
            "rankingVersion": "weighted-v1",
            "selectedRank": 1,
            "overrideReason": None,
        }
        with self.post(command, "/v1/assignments") as response:
            offered = json.loads(response.read().decode("utf-8"))
        cancellation = {
            "jobId": job["jobId"],
            "assignmentId": offered["assignmentId"],
            "actorId": "admin-1",
            "expectedJobVersion": offered["jobVersion"],
            "reason": "Admin cancelled the offer",
        }
        with self.post(cancellation, "/v1/assignment-cancellations") as response:
            cancelled = json.loads(response.read().decode("utf-8"))
        self.assertEqual(cancelled["status"], "CANCELLED")
        self.assertEqual(cancelled["jobVersion"], 2)


if __name__ == "__main__":
    unittest.main()
