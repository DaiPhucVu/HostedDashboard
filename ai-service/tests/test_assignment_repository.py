from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import unittest

from app.domain.models import AssignmentCancellationCommand, AssignmentCommand
from app.repositories.assignment_errors import AssignmentConflict, AssignmentValidationError
from app.repositories.local_assignment import LocalAssignmentRepository
from app.services.assignment_review import AssignmentReviewService


VALID_JOB = {
    "jobId": "job-local-plumbing",
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


class LocalAssignmentRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.service = AssignmentReviewService()
        self.repository = LocalAssignmentRepository(self.service.providers)

    def register(self, job_id="job-local-assign"):
        job = dict(VALID_JOB, jobId=job_id)
        review = self.service.review(job)
        self.repository.register_review(job, review)
        return job, review

    def command(self, job_id, key, selected_rank=1, override_reason=None):
        return AssignmentCommand(
            job_id=job_id,
            provider_id="11111111-1111-1111-1111-111111111111",
            actor_id="admin-1",
            expected_job_version=0,
            idempotency_key=key,
            ranking_version="weighted-v1",
            selected_rank=selected_rank,
            override_reason=override_reason,
        )

    def test_same_idempotency_key_returns_same_assignment(self):
        self.register("job-idempotent")
        command = self.command("job-idempotent", "job-idempotent-key")
        first = self.repository.assign(command)
        second = self.repository.assign(command)
        self.assertEqual(first, second)

    def test_fifty_racing_commands_create_one_assignment(self):
        self.register("job-race")

        def attempt(index):
            try:
                return self.repository.assign(self.command("job-race", "job-race-key-{:02d}".format(index)))
            except AssignmentConflict:
                return None

        with ThreadPoolExecutor(max_workers=16) as executor:
            results = list(executor.map(attempt, range(50)))
        self.assertEqual(sum(result is not None for result in results), 1)

    def test_override_reason_is_required_outside_rank_one(self):
        self.register("job-override")
        with self.assertRaises(AssignmentValidationError):
            self.repository.assign(self.command("job-override", "job-override-key", selected_rank=2))

    def test_cancelled_offer_releases_job_for_a_new_assignment(self):
        self.register("job-cancel")
        offered = self.repository.assign(self.command("job-cancel", "job-cancel-key"))
        cancelled = self.repository.cancel(AssignmentCancellationCommand(
            job_id="job-cancel",
            assignment_id=offered.assignment_id,
            actor_id="admin-1",
            expected_job_version=offered.job_version,
            reason="Customer requested a different time",
        ))
        self.assertEqual(cancelled.status, "CANCELLED")
        self.assertEqual(cancelled.job_version, 2)

        reassigned = self.repository.assign(AssignmentCommand(
            job_id="job-cancel",
            provider_id="11111111-1111-1111-1111-111111111111",
            actor_id="admin-1",
            expected_job_version=2,
            idempotency_key="job-cancel-new-key",
            ranking_version="weighted-v1",
            selected_rank=1,
        ))
        self.assertEqual(reassigned.status, "OFFERED")

    def test_related_specialty_provider_can_complete_category_assignment(self):
        provider = replace(
            self.service.providers[0],
            provider_id="facial-provider",
            skills=("facial",),
        )
        repository = LocalAssignmentRepository([provider])
        job = dict(VALID_JOB, jobId="beauty-assignment")
        repository.register_review(job, {
            "triage": {
                "triageStatus": "READY_FOR_ASSIGNMENT",
                "requiredSkills": ["beauty_wellness"],
            },
        })

        result = repository.assign(AssignmentCommand(
            job_id="beauty-assignment",
            provider_id="facial-provider",
            actor_id="admin-1",
            expected_job_version=0,
            idempotency_key="beauty-assignment-key",
            ranking_version="weighted-v4-category-family",
            selected_rank=1,
        ))

        self.assertEqual("OFFERED", result.status)


class FakeCursor:
    def __init__(self):
        self.statement = ""
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def execute(self, statement, parameters):
        self.statement = " ".join(statement.split())
        self.statements.append((self.statement, parameters))

    def fetchone(self):
        if "WHERE a.idempotency_key" in self.statement:
            return None
        if "WHERE a.assignment_id" in self.statement:
            return ("assignment-1", "job-1", "provider-1", "OFFERED", 1, "job-1-key")
        if "FROM jobs" in self.statement:
            return (
                "READY_FOR_ASSIGNMENT",
                0,
                {"requiredSkills": ["plumbing"]},
                23.7461,
                90.3742,
            )
        if "FROM providers" in self.statement:
            return (True, True, 0, 3, 23.7465, 90.3760, 15)
        if "RETURNING version" in self.statement:
            return (2,) if "READY_FOR_ASSIGNMENT" in self.statement else (1,)
        return None

    def fetchall(self):
        if "FROM provider_skills" in self.statement:
            return [("plumbing",)]
        return []


class FakeConnection:
    def __init__(self):
        self.cursor_instance = FakeCursor()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def cursor(self):
        return self.cursor_instance


class PostgresAssignmentRepositoryTests(unittest.TestCase):
    def test_success_path_uses_locks_updates_and_audit_event(self):
        from app.repositories.postgres_assignment import PostgresAssignmentRepository

        connection = FakeConnection()
        repository = PostgresAssignmentRepository(lambda: connection)
        result = repository.assign(AssignmentCommand(
            job_id="job-1",
            provider_id="provider-1",
            actor_id="admin-1",
            expected_job_version=0,
            idempotency_key="job-1-key",
            ranking_version="weighted-v1",
            selected_rank=1,
        ))
        sql = "\n".join(statement for statement, _ in connection.cursor_instance.statements)
        self.assertEqual(result.job_version, 1)
        self.assertGreaterEqual(sql.count("FOR UPDATE"), 2)
        self.assertIn("UPDATE providers", sql)
        self.assertIn("UPDATE jobs", sql)
        self.assertIn("INSERT INTO assignment_events", sql)

    def test_cancellation_releases_capacity_and_records_an_event(self):
        from app.repositories.postgres_assignment import PostgresAssignmentRepository

        connection = FakeConnection()
        repository = PostgresAssignmentRepository(lambda: connection)
        result = repository.cancel(AssignmentCancellationCommand(
            job_id="job-1",
            assignment_id="assignment-1",
            actor_id="admin-1",
            expected_job_version=1,
            reason="Admin cancelled the offer",
        ))
        sql = "\n".join(statement for statement, _ in connection.cursor_instance.statements)
        self.assertEqual(result.status, "CANCELLED")
        self.assertEqual(result.job_version, 2)
        self.assertIn("GREATEST(active_jobs - 1, 0)", sql)
        self.assertIn("ASSIGNMENT_CANCELLED", sql)
        self.assertIn("READY_FOR_ASSIGNMENT", sql)


if __name__ == "__main__":
    unittest.main()
