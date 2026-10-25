import json
from typing import Any, Callable, Dict, Optional, Sequence, Tuple
from uuid import uuid4

from app.domain.models import AssignmentCancellationCommand, AssignmentCommand, AssignmentRecord
from app.domain.skills import provider_has_required_skills
from app.repositories.assignment_errors import (
    AssignmentConflict,
    AssignmentEligibilityError,
    AssignmentNotFound,
    AssignmentValidationError,
)
from app.repositories.base import AssignmentRepository
from app.ranking.weighted import haversine_km


READY_STATES = ("READY_FOR_ASSIGNMENT", "CANDIDATES_READY")


class PostgresAssignmentRepository(AssignmentRepository):
    """DB-API compatible PostgreSQL adapter; the connection factory may be pooled."""

    def __init__(self, connection_factory: Callable[[], Any]):
        self.connection_factory = connection_factory

    @staticmethod
    def _record(row: Sequence[Any]) -> AssignmentRecord:
        return AssignmentRecord(
            assignment_id=str(row[0]),
            job_id=str(row[1]),
            provider_id=str(row[2]),
            status=str(row[3]),
            job_version=int(row[4]),
            idempotency_key=str(row[5]),
        )

    @staticmethod
    def _required_skills(triage_result: Any) -> Tuple[str, ...]:
        if isinstance(triage_result, str):
            triage_result = json.loads(triage_result)
        return tuple((triage_result or {}).get("requiredSkills", []))

    def find_by_idempotency_key(self, idempotency_key: str) -> Optional[AssignmentRecord]:
        with self.connection_factory() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT a.assignment_id, a.job_id, a.provider_id, a.status,
                           j.version, a.idempotency_key
                    FROM assignments a
                    JOIN jobs j ON j.job_id = a.job_id
                    WHERE a.idempotency_key = %s
                    """,
                    (idempotency_key,),
                )
                row = cursor.fetchone()
                return self._record(row) if row else None

    def assign(self, command: AssignmentCommand) -> AssignmentRecord:
        if command.selected_rank != 1 and not (command.override_reason or "").strip():
            raise AssignmentValidationError("Override reason is required outside rank 1")

        assignment_id = str(uuid4())
        with self.connection_factory() as connection:
            with connection.cursor() as cursor:
                existing = self._find_locked_transaction(cursor, command.idempotency_key)
                if existing:
                    return existing

                cursor.execute(
                    """
                    SELECT workflow_status, version, triage_result, latitude, longitude
                    FROM jobs
                    WHERE job_id = %s
                    FOR UPDATE
                    """,
                    (command.job_id,),
                )
                job = cursor.fetchone()
                if not job:
                    raise AssignmentNotFound("Job was not found")

                # Re-check after waiting for the job lock so a concurrent retry
                # with the same key returns the first committed assignment.
                existing = self._find_locked_transaction(cursor, command.idempotency_key)
                if existing:
                    return existing
                if job[0] not in READY_STATES or int(job[1]) != command.expected_job_version:
                    raise AssignmentConflict("Job state or version changed")

                cursor.execute(
                    """
                    SELECT verified, available, active_jobs, max_concurrent_jobs,
                           latitude, longitude, service_radius_km
                    FROM providers
                    WHERE provider_id = %s
                    FOR UPDATE
                    """,
                    (command.provider_id,),
                )
                provider = cursor.fetchone()
                if not provider:
                    raise AssignmentNotFound("Provider was not found")
                if not provider[0] or not provider[1] or int(provider[2]) >= int(provider[3]):
                    raise AssignmentEligibilityError("Provider is unavailable or at capacity")
                if job[3] is None or job[4] is None or provider[4] is None or provider[5] is None:
                    raise AssignmentEligibilityError("Job or provider coordinates are missing")
                distance_km = haversine_km(
                    float(job[3]), float(job[4]), float(provider[4]), float(provider[5])
                )
                if distance_km > float(provider[6]):
                    raise AssignmentEligibilityError("Provider is outside the service radius")

                required_skills = self._required_skills(job[2])
                cursor.execute(
                    "SELECT skill_id FROM provider_skills WHERE provider_id = %s",
                    (command.provider_id,),
                )
                provider_skills = {str(row[0]) for row in cursor.fetchall()}
                if not provider_has_required_skills(provider_skills, required_skills):
                    raise AssignmentEligibilityError("Provider is missing a required skill")

                cursor.execute(
                    """
                    INSERT INTO assignments(
                        assignment_id, job_id, provider_id, status, assigned_by,
                        idempotency_key, ranking_version, selected_rank, override_reason
                    ) VALUES (%s, %s, %s, 'OFFERED', %s, %s, %s, %s, %s)
                    """,
                    (
                        assignment_id,
                        command.job_id,
                        command.provider_id,
                        command.actor_id,
                        command.idempotency_key,
                        command.ranking_version,
                        command.selected_rank,
                        command.override_reason,
                    ),
                )
                cursor.execute(
                    """
                    UPDATE providers
                    SET active_jobs = active_jobs + 1,
                        version = version + 1,
                        updated_at = now()
                    WHERE provider_id = %s
                    """,
                    (command.provider_id,),
                )
                cursor.execute(
                    """
                    UPDATE jobs
                    SET workflow_status = 'OFFERED', version = version + 1, updated_at = now()
                    WHERE job_id = %s
                    RETURNING version
                    """,
                    (command.job_id,),
                )
                job_version = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    INSERT INTO assignment_events(
                        assignment_id, job_id, actor_id, event_type, event_payload
                    ) VALUES (%s, %s, %s, 'ASSIGNMENT_OFFERED', %s)
                    """,
                    (
                        assignment_id,
                        command.job_id,
                        command.actor_id,
                        json.dumps({
                            "rankingVersion": command.ranking_version,
                            "selectedRank": command.selected_rank,
                            "overrideReason": command.override_reason,
                        }),
                    ),
                )
                return AssignmentRecord(
                    assignment_id=assignment_id,
                    job_id=command.job_id,
                    provider_id=command.provider_id,
                    status="OFFERED",
                    job_version=job_version,
                    idempotency_key=command.idempotency_key,
                )

    def cancel(self, command: AssignmentCancellationCommand) -> AssignmentRecord:
        with self.connection_factory() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT a.assignment_id, a.job_id, a.provider_id, a.status,
                           j.version, a.idempotency_key
                    FROM assignments a
                    JOIN jobs j ON j.job_id = a.job_id
                    WHERE a.assignment_id = %s AND a.job_id = %s
                    FOR UPDATE OF a, j
                    """,
                    (command.assignment_id, command.job_id),
                )
                row = cursor.fetchone()
                if not row:
                    raise AssignmentNotFound("Assignment was not found")
                if str(row[3]) == "CANCELLED":
                    return self._record(row)
                if str(row[3]) != "OFFERED":
                    raise AssignmentConflict("Only an offered assignment can be cancelled")
                if int(row[4]) != command.expected_job_version:
                    raise AssignmentConflict("Job version is stale")

                cursor.execute(
                    """
                    UPDATE assignments
                    SET status = 'CANCELLED', updated_at = now()
                    WHERE assignment_id = %s
                    """,
                    (command.assignment_id,),
                )
                cursor.execute(
                    """
                    UPDATE providers
                    SET active_jobs = GREATEST(active_jobs - 1, 0),
                        version = version + 1,
                        updated_at = now()
                    WHERE provider_id = %s
                    """,
                    (str(row[2]),),
                )
                cursor.execute(
                    """
                    UPDATE jobs
                    SET workflow_status = 'READY_FOR_ASSIGNMENT',
                        version = version + 1,
                        updated_at = now()
                    WHERE job_id = %s
                    RETURNING version
                    """,
                    (command.job_id,),
                )
                job_version = int(cursor.fetchone()[0])
                cursor.execute(
                    """
                    INSERT INTO assignment_events(
                        assignment_id, job_id, actor_id, event_type, event_payload
                    ) VALUES (%s, %s, %s, 'ASSIGNMENT_CANCELLED', %s)
                    """,
                    (
                        command.assignment_id,
                        command.job_id,
                        command.actor_id,
                        json.dumps({"reason": command.reason}),
                    ),
                )
                return AssignmentRecord(
                    assignment_id=command.assignment_id,
                    job_id=command.job_id,
                    provider_id=str(row[2]),
                    status="CANCELLED",
                    job_version=job_version,
                    idempotency_key=str(row[5]),
                )

    def _find_locked_transaction(self, cursor: Any, idempotency_key: str) -> Optional[AssignmentRecord]:
        cursor.execute(
            """
            SELECT a.assignment_id, a.job_id, a.provider_id, a.status,
                   j.version, a.idempotency_key
            FROM assignments a
            JOIN jobs j ON j.job_id = a.job_id
            WHERE a.idempotency_key = %s
            """,
            (idempotency_key,),
        )
        row = cursor.fetchone()
        return self._record(row) if row else None
