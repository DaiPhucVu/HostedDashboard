import copy
import unittest
from pathlib import Path

from app.services.firebase_auto_assignment import FirebaseAutoAssignmentRunner
from app.services.firebase_data_adapter import FirebaseDataAdapter


ROOT = Path(__file__).resolve().parents[1]


def get_path(data, path):
    current = data
    for part in [item for item in path.split("/") if item]:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def set_path(data, path, value):
    parts = [item for item in path.split("/") if item]
    current = data
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    if not parts:
        data.clear()
        data.update(copy.deepcopy(value))
    elif value is None:
        current.pop(parts[-1], None)
    else:
        current[parts[-1]] = copy.deepcopy(value)


class MemoryFirebaseClient:
    def __init__(self, data):
        self.data = copy.deepcopy(data)
        self.version = 0

    def get(self, path=""):
        return copy.deepcopy(get_path(self.data, path) if path else self.data)

    def get_with_etag(self, path):
        return self.get(path), str(self.version)

    def put_if_unchanged(self, path, value, etag):
        if str(self.version) != etag:
            return False
        set_path(self.data, path, value)
        self.version += 1
        return True

    def patch(self, path, values):
        prefix = path.strip("/")
        for key, value in values.items():
            full_path = "/".join(item for item in (prefix, key) if item)
            set_path(self.data, full_path, value)
        self.version += 1


class StaticReviewService:
    def __init__(self, decision="AUTO_ASSIGN", on_review=None):
        self.decision = decision
        self.on_review = on_review

    def review(self, job, providers):
        if self.on_review:
            self.on_review()
        provider_id = "provider-1" if self.decision == "AUTO_ASSIGN" else None
        candidates = [{
            "providerId": "provider-1",
            "rank": 1,
            "totalScore": 0.82,
            "scoreBreakdown": {"relevantExperience": 0.9},
            "reasonCodes": ["CATEGORY_SKILL_MATCH"],
            "evidence": {},
        }]
        return {
            "triage": {
                "jobId": job["jobId"],
                "triageStatus": "READY_FOR_ASSIGNMENT",
                "categoryId": "plumbing",
                "originalCategory": "electrical",
                "semanticCategory": "plumbing",
                "finalCategory": "plumbing",
                "categoryDecision": "SEMANTIC_OVERRIDE",
                "overrideReason": "PIPE_ENTITY",
                "urgency": "NORMAL",
                "issueSummary": "Kitchen pipe leak",
                "modelVersion": "test-model",
            },
            "ranking": {
                "jobId": job["jobId"],
                "rankingVersion": "ranking-test",
                "candidates": candidates,
            },
            "autoAssignment": {
                "decision": self.decision,
                "providerId": provider_id,
                "selectedRank": 1 if provider_id else None,
                "score": 0.82 if provider_id else None,
                "runnerUpScore": None,
                "scoreMargin": None,
                "minimumScore": 0.6,
                "minimumMargin": 0.0,
                "reasonCodes": ["ALL_AUTO_ASSIGN_GATES_PASSED"] if provider_id else ["TOP_SCORE_BELOW_THRESHOLD"],
            },
        }


class FailingReviewService:
    def review(self, job, providers):
        raise RuntimeError("model unavailable")


def initial_data(created_at="2026-10-04T10:01:00Z"):
    return {
        "Settings": {"jobAssignment": {
            "mode": "AUTO",
            "enabledAt": "2026-10-04T10:00:00Z",
        }},
        "Job": {"job-1": {
            "jobCat": "Plumbing",
            "jobDesc": "Kitchen pipe is leaking",
            "jobLocation": "Gulshan",
            "latitude": 23.7925,
            "longitude": 90.4078,
            "jobDateFrom": "2026-10-05",
            "jobStatus": "Open",
            "createdAt": created_at,
            "customerId": "customer-1",
        }},
        "Handyman": {"provider-1": {
            "handymanId": "provider-1",
            "firstName": "Rafi",
            "lastName": "Khan",
            "verificationStatus": "approved",
            "available": True,
            "primaryTrade": "Plumbing",
            "latitude": 23.7925,
            "longitude": 90.4078,
            "serviceRadiusKm": 20,
            "maxConcurrentJobs": 3,
        }},
        "Reviews": {},
        "User": {"customer-1": {
            "notAssignedJobs": {"legacy-key": "job-1"},
        }},
    }


class FirebaseAutoAssignmentRunnerTests(unittest.TestCase):
    def runner(self, client, service):
        return FirebaseAutoAssignmentRunner(
            client,
            service,
            FirebaseDataAdapter(ROOT / "taxonomy" / "service_taxonomy.json"),
            worker_id="worker-test",
        )

    def test_assigns_rank_one_and_updates_mobile_indexes(self):
        client = MemoryFirebaseClient(initial_data())
        result = self.runner(client, StaticReviewService()).process_next()
        job = client.data["Job"]["job-1"]

        self.assertEqual("AUTO_ASSIGNED", result)
        self.assertEqual("provider-1", job["assignedTo"])
        self.assertEqual("AUTO_AI_RECOMMENDED", job["assignmentMethod"])
        self.assertEqual("AUTO_ASSIGNED", job["autoAssignmentStatus"])
        self.assertEqual(1, job["assignmentVersion"])
        self.assertEqual("provider-1", job["assignmentAudit"]["providerId"])
        self.assertEqual(
            "SEMANTIC_OVERRIDE",
            job["assignmentAudit"]["triage"]["categoryDecision"],
        )
        self.assertEqual("job-1", client.data["Handyman"]["provider-1"]["allJobs"]["job-1"])
        self.assertNotIn("legacy-key", client.data["User"]["customer-1"]["notAssignedJobs"])
        self.assertEqual("job-1", client.data["User"]["customer-1"]["assignedJobs"]["job-1"])

    def test_low_confidence_result_waits_for_manual_review(self):
        client = MemoryFirebaseClient(initial_data())
        result = self.runner(
            client,
            StaticReviewService("MANUAL_REVIEW"),
        ).process_next()
        job = client.data["Job"]["job-1"]

        self.assertEqual("MANUAL_REVIEW", result)
        self.assertEqual("MANUAL_REVIEW", job["autoAssignmentStatus"])
        self.assertNotIn("assignedTo", job)

    def test_ignores_jobs_created_before_auto_mode_was_enabled(self):
        client = MemoryFirebaseClient(initial_data("2026-10-04T09:59:00Z"))
        result = self.runner(client, StaticReviewService()).process_next()

        self.assertEqual("IDLE", result)
        self.assertNotIn("autoAssignmentStatus", client.data["Job"]["job-1"])

    def test_mode_change_during_review_prevents_assignment(self):
        client = MemoryFirebaseClient(initial_data())

        def disable_auto():
            client.data["Settings"]["jobAssignment"]["mode"] = "MANUAL"

        result = self.runner(
            client,
            StaticReviewService(on_review=disable_auto),
        ).process_next()
        job = client.data["Job"]["job-1"]

        self.assertEqual("MANUAL_REVIEW", result)
        self.assertEqual("MANUAL_REVIEW", job["autoAssignmentStatus"])
        self.assertIn("AUTO_MODE_CHANGED", job["autoAssignmentDecision"]["reasonCodes"])
        self.assertNotIn("assignedTo", job)

    def test_review_failure_returns_job_to_manual_review(self):
        client = MemoryFirebaseClient(initial_data())

        result = self.runner(client, FailingReviewService()).process_next()
        job = client.data["Job"]["job-1"]

        self.assertEqual("ERROR", result)
        self.assertEqual("MANUAL_REVIEW", job["autoAssignmentStatus"])
        self.assertEqual(
            ["AUTO_ASSIGNMENT_ERROR"],
            job["autoAssignmentDecision"]["reasonCodes"],
        )
        self.assertEqual("model unavailable", job["autoAssignmentError"])
        self.assertNotIn("assignedTo", job)

    def test_worker_lease_prevents_two_runners_from_assigning_concurrently(self):
        client = MemoryFirebaseClient(initial_data())
        first = self.runner(client, StaticReviewService())
        second = FirebaseAutoAssignmentRunner(
            client,
            StaticReviewService(),
            FirebaseDataAdapter(ROOT / "taxonomy" / "service_taxonomy.json"),
            worker_id="worker-second",
        )

        self.assertTrue(first._acquire_lease())
        self.assertEqual("LEASE_HELD", second.process_next())
        first.release_lease()
        self.assertIsNone(client.get("Settings/jobAssignment/workerLease"))


if __name__ == "__main__":
    unittest.main()
