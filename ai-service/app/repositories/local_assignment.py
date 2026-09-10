from threading import Lock
from typing import Any, Dict, Iterable, Optional
from uuid import uuid4

from app.domain.models import (
    AssignmentCancellationCommand,
    AssignmentCommand,
    AssignmentRecord,
    ProviderProfile,
)
from app.domain.skills import provider_has_required_skills
from app.repositories.assignment_errors import (
    AssignmentConflict,
    AssignmentEligibilityError,
    AssignmentNotFound,
    AssignmentValidationError,
)
from app.repositories.base import AssignmentRepository
from app.ranking.weighted import haversine_km


class LocalAssignmentRepository(AssignmentRepository):
    """Thread-safe local proof of the production assignment invariants."""

    def __init__(self, providers: Iterable[ProviderProfile]):
        self._lock = Lock()
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._providers = {provider.provider_id: provider for provider in providers}
        self._active_jobs = {provider.provider_id: provider.active_jobs for provider in providers}
        self._records: Dict[str, AssignmentRecord] = {}
        self._records_by_id: Dict[str, AssignmentRecord] = {}

    def register_review(self, job_payload: Dict[str, Any], review: Dict[str, Any]) -> None:
        triage = review["triage"]
        with self._lock:
            current = self._jobs.get(job_payload["jobId"])
            if current and current["version"] > int(job_payload.get("version", 0)):
                return
            self._jobs[job_payload["jobId"]] = {
                "status": triage["triageStatus"],
                "version": int(job_payload.get("version", 0)),
                "required_skills": tuple(triage["requiredSkills"]),
                "latitude": job_payload.get("latitude"),
                "longitude": job_payload.get("longitude"),
            }

    def find_by_idempotency_key(self, idempotency_key: str) -> Optional[AssignmentRecord]:
        with self._lock:
            return self._records.get(idempotency_key)

    def assign(self, command: AssignmentCommand) -> AssignmentRecord:
        with self._lock:
            existing = self._records.get(command.idempotency_key)
            if existing:
                return existing
            job = self._jobs.get(command.job_id)
            provider = self._providers.get(command.provider_id)
            if not job or not provider:
                raise AssignmentNotFound("Job or provider was not found")
            if job["status"] != "READY_FOR_ASSIGNMENT":
                raise AssignmentConflict("Job is not ready for assignment")
            if job["version"] != command.expected_job_version:
                raise AssignmentConflict("Job version is stale")
            if command.selected_rank != 1 and not (command.override_reason or "").strip():
                raise AssignmentValidationError("Override reason is required outside rank 1")
            if not provider.verified or not provider.available:
                raise AssignmentEligibilityError("Provider is not verified and available")
            if not provider_has_required_skills(provider.skills, job["required_skills"]):
                raise AssignmentEligibilityError("Provider is missing a required skill")
            if self._active_jobs[provider.provider_id] >= provider.max_concurrent_jobs:
                raise AssignmentEligibilityError("Provider is at capacity")
            if job["latitude"] is None or job["longitude"] is None:
                raise AssignmentEligibilityError("Job coordinates are missing")
            distance_km = haversine_km(
                float(job["latitude"]),
                float(job["longitude"]),
                provider.latitude,
                provider.longitude,
            )
            if distance_km > provider.service_radius_km:
                raise AssignmentEligibilityError("Provider is outside the service radius")

            job["version"] += 1
            job["status"] = "OFFERED"
            self._active_jobs[provider.provider_id] += 1
            record = AssignmentRecord(
                assignment_id=str(uuid4()),
                job_id=command.job_id,
                provider_id=command.provider_id,
                status="OFFERED",
                job_version=job["version"],
                idempotency_key=command.idempotency_key,
            )
            self._records[command.idempotency_key] = record
            self._records_by_id[record.assignment_id] = record
            return record

    def cancel(self, command: AssignmentCancellationCommand) -> AssignmentRecord:
        with self._lock:
            record = self._records_by_id.get(command.assignment_id)
            job = self._jobs.get(command.job_id)
            if not record or not job or record.job_id != command.job_id:
                raise AssignmentNotFound("Assignment was not found")
            if record.status == "CANCELLED":
                return record
            if record.status != "OFFERED":
                raise AssignmentConflict("Only an offered assignment can be cancelled")
            if job["version"] != command.expected_job_version:
                raise AssignmentConflict("Job version is stale")

            job["version"] += 1
            job["status"] = "READY_FOR_ASSIGNMENT"
            self._active_jobs[record.provider_id] = max(
                0, self._active_jobs[record.provider_id] - 1
            )
            cancelled = AssignmentRecord(
                assignment_id=record.assignment_id,
                job_id=record.job_id,
                provider_id=record.provider_id,
                status="CANCELLED",
                job_version=job["version"],
                idempotency_key=record.idempotency_key,
            )
            self._records[record.idempotency_key] = cancelled
            self._records_by_id[record.assignment_id] = cancelled
            return cancelled
