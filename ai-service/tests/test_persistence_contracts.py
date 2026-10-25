from pathlib import Path
import unittest

from app.domain.models import AssignmentCommand


ROOT = Path(__file__).resolve().parents[1]


class PersistenceContractTests(unittest.TestCase):
    def test_assignment_command_carries_concurrency_guards(self):
        command = AssignmentCommand(
            job_id="job-1",
            provider_id="provider-1",
            actor_id="admin-1",
            expected_job_version=4,
            idempotency_key="assign-job-1-v4",
        )
        self.assertEqual(command.expected_job_version, 4)
        self.assertTrue(command.idempotency_key)

    def test_core_migration_has_database_assignment_guards(self):
        sql = (ROOT / "migrations" / "001_postgres_core.sql").read_text(encoding="utf-8")
        self.assertIn("idempotency_key text NOT NULL UNIQUE", sql)
        self.assertIn("CREATE UNIQUE INDEX one_active_assignment_per_job", sql)
        self.assertIn("version bigint NOT NULL DEFAULT 0", sql)


if __name__ == "__main__":
    unittest.main()
