import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from app.repositories.firebase_rest import FirebaseRestClient
from app.services.assignment_review import AssignmentReviewService
from app.services.firebase_data_adapter import FirebaseDataAdapter


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _timestamp(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value) / 1000 if value > 10_000_000_000 else float(value)
    if isinstance(value, dict) and isinstance(value.get("seconds"), (int, float)):
        return float(value["seconds"])
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _assigned_provider_id(job: Dict[str, Any]) -> str:
    assignment = job.get("assignment") or {}
    return str(
        job.get("assignedTo")
        or assignment.get("providerId")
        or assignment.get("assignedTo")
        or ""
    )


class FirebaseAutoAssignmentRunner:
    def __init__(
        self,
        client: FirebaseRestClient,
        review_service: AssignmentReviewService,
        adapter: FirebaseDataAdapter,
        worker_id: Optional[str] = None,
        claim_timeout_seconds: int = 900,
    ):
        self.client = client
        self.review_service = review_service
        self.adapter = adapter
        self.worker_id = worker_id or f"auto-worker-{uuid4()}"
        self.claim_timeout_seconds = claim_timeout_seconds

    def _mode(self) -> Dict[str, Any]:
        return self.client.get("Settings/jobAssignment") or {"mode": "MANUAL"}

    @staticmethod
    def _same_auto_run(started: Dict[str, Any], latest: Dict[str, Any]) -> bool:
        return (
            started.get("mode") == "AUTO"
            and latest.get("mode") == "AUTO"
            and bool(started.get("enabledAt"))
            and started.get("enabledAt") == latest.get("enabledAt")
        )

    def _acquire_lease(self) -> bool:
        path = "Settings/jobAssignment/workerLease"
        lease, etag = self.client.get_with_etag(path)
        now = time.time()
        if (
            lease
            and lease.get("ownerId") != self.worker_id
            and float(lease.get("expiresAtEpoch", 0)) > now
        ):
            return False
        return self.client.put_if_unchanged(path, {
            "ownerId": self.worker_id,
            "expiresAtEpoch": now + self.claim_timeout_seconds,
            "updatedAt": _utc_now(),
        }, etag)

    def release_lease(self) -> None:
        path = "Settings/jobAssignment/workerLease"
        lease, etag = self.client.get_with_etag(path)
        if lease and lease.get("ownerId") == self.worker_id:
            self.client.put_if_unchanged(path, None, etag)

    def _is_new_open_job(
        self,
        job_id: str,
        job: Dict[str, Any],
        mode: Dict[str, Any],
    ) -> bool:
        if not job_id or _assigned_provider_id(job) or job.get("autoAssignmentDisabled"):
            return False
        if str(job.get("jobStatus") or "Open").strip().casefold() != "open":
            return False
        created_at = _timestamp(
            job.get("createdAt") or job.get("postedAt") or job.get("created_at")
        )
        enabled_at = _timestamp(mode.get("enabledAt"))
        if created_at is None or enabled_at is None or created_at < enabled_at:
            return False
        status = str(job.get("autoAssignmentStatus") or "")
        if not status:
            return True
        if status != "PROCESSING":
            return False
        claimed_at = _timestamp(job.get("autoAssignmentClaimedAt"))
        return claimed_at is None or time.time() - claimed_at > self.claim_timeout_seconds

    def _claim(self, job_id: str, mode: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        path = f"Job/{job_id}"
        job, etag = self.client.get_with_etag(path)
        if not job or not self._is_new_open_job(job_id, job, mode):
            return None
        claimed = {
            **job,
            "autoAssignmentStatus": "PROCESSING",
            "autoAssignmentClaimId": self.worker_id,
            "autoAssignmentClaimedAt": _utc_now(),
            "lastUpdated": _utc_now(),
        }
        if not self.client.put_if_unchanged(path, claimed, etag):
            return None
        return {"jobId": job_id, **claimed}

    def _update_claimed_job(
        self,
        job_id: str,
        changes: Dict[str, Any],
    ) -> bool:
        path = f"Job/{job_id}"
        job, etag = self.client.get_with_etag(path)
        if (
            not job
            or job.get("autoAssignmentStatus") != "PROCESSING"
            or job.get("autoAssignmentClaimId") != self.worker_id
        ):
            return False
        return self.client.put_if_unchanged(path, {**job, **changes}, etag)

    def _mark_manual_review(
        self,
        job_id: str,
        decision: Dict[str, Any],
    ) -> str:
        self._update_claimed_job(job_id, {
            "autoAssignmentStatus": "MANUAL_REVIEW",
            "autoAssignmentDecision": decision,
            "autoAssignmentReviewedAt": _utc_now(),
            "autoAssignmentClaimId": None,
            "lastUpdated": _utc_now(),
        })
        return "MANUAL_REVIEW"

    @staticmethod
    def _provider_name(provider_id: str, provider: Dict[str, Any]) -> str:
        return (
            f"{provider.get('firstName', '')} {provider.get('lastName', '')}".strip()
            or str(provider.get("displayName") or provider.get("name") or provider.get("email") or provider_id)
        )

    @staticmethod
    def _assignment_audit(
        review: Dict[str, Any],
        provider_id: str,
        provider_name: str,
        assigned_at: str,
    ) -> Dict[str, Any]:
        candidate = next(
            item
            for item in review["ranking"]["candidates"]
            if item["providerId"] == provider_id
        )
        triage = review["triage"]
        return {
            "method": "AUTO_AI_RECOMMENDED",
            "providerId": provider_id,
            "providerName": provider_name,
            "recordedAt": assigned_at,
            "rankingVersion": review["ranking"]["rankingVersion"],
            "triage": {
                "categoryId": triage.get("categoryId"),
                "originalCategory": triage.get("originalCategory"),
                "semanticCategory": triage.get("semanticCategory"),
                "finalCategory": triage.get("finalCategory"),
                "categoryDecision": triage.get("categoryDecision"),
                "overrideReason": triage.get("overrideReason"),
                "urgency": triage.get("urgency"),
                "issueSummary": triage.get("issueSummary", ""),
                "modelVersion": triage.get("modelVersion"),
            },
            "candidate": candidate,
            "autoAssignmentDecision": review["autoAssignment"],
        }

    def _sync_indexes(self, job: Dict[str, Any], provider_id: str) -> None:
        job_id = job["jobId"]
        updates: Dict[str, Any] = {
            f"Handyman/{provider_id}/allJobs/{job_id}": job_id,
        }
        customer_id = job.get("customerId")
        if customer_id:
            not_assigned = self.client.get(
                f"User/{customer_id}/notAssignedJobs"
            ) or {}
            if isinstance(not_assigned, dict):
                for key, value in not_assigned.items():
                    if value == job_id:
                        updates[f"User/{customer_id}/notAssignedJobs/{key}"] = None
            updates.update({
                f"User/{customer_id}/assignedJobs/{job_id}": job_id,
                f"User/{customer_id}/allJobs/{job_id}": job_id,
            })
        self.client.patch("", updates)

    def _finalise_indexed_job(self, job_id: str, provider_id: str) -> bool:
        path = f"Job/{job_id}"
        job, etag = self.client.get_with_etag(path)
        if (
            not job
            or job.get("autoAssignmentStatus") != "INDEXING"
            or _assigned_provider_id(job) != provider_id
            or job.get("assignmentMethod") != "AUTO_AI_RECOMMENDED"
        ):
            return False
        finalised = {
            **job,
            "autoAssignmentStatus": "AUTO_ASSIGNED",
            "autoAssignmentClaimId": None,
            "lastUpdated": _utc_now(),
        }
        return self.client.put_if_unchanged(path, finalised, etag)

    def _repair_indexes(self, jobs: Dict[str, Dict[str, Any]]) -> bool:
        for job_id, job_value in jobs.items():
            job = {"jobId": job_id, **(job_value or {})}
            provider_id = _assigned_provider_id(job)
            if (
                job.get("autoAssignmentStatus") == "INDEXING"
                and job.get("assignmentMethod") == "AUTO_AI_RECOMMENDED"
                and provider_id
            ):
                self._sync_indexes(job, provider_id)
                self._finalise_indexed_job(job_id, provider_id)
                return True
        return False

    def _mark_error(self, job_id: str, error: Exception) -> None:
        self._update_claimed_job(job_id, {
            "autoAssignmentStatus": "MANUAL_REVIEW",
            "autoAssignmentDecision": {
                "decision": "MANUAL_REVIEW",
                "providerId": None,
                "selectedRank": None,
                "reasonCodes": ["AUTO_ASSIGNMENT_ERROR"],
            },
            "autoAssignmentError": str(error)[:240],
            "autoAssignmentClaimId": None,
            "autoAssignmentReviewedAt": _utc_now(),
            "lastUpdated": _utc_now(),
        })

    def process_next(self) -> str:
        mode = self._mode()
        if mode.get("mode") != "AUTO" or not mode.get("enabledAt"):
            return "MANUAL_MODE"
        if not self._acquire_lease():
            return "LEASE_HELD"

        jobs = self.client.get("Job") or {}
        if self._repair_indexes(jobs):
            return "INDEX_REPAIRED"
        eligible = [
            (job_id, job or {})
            for job_id, job in jobs.items()
            if self._is_new_open_job(job_id, job or {}, mode)
        ]
        eligible.sort(
            key=lambda item: (
                _timestamp(item[1].get("createdAt")) or 0,
                item[0],
            )
        )
        if not eligible:
            return "IDLE"

        job_id, _ = eligible[0]
        claimed_job = self._claim(job_id, mode)
        if not claimed_job:
            return "CONFLICT"
        try:
            jobs = self.client.get("Job") or {}
            providers = self.client.get("Handyman") or {}
            reviews = self.client.get("Reviews") or {}
            provider_payloads = self.adapter.provider_payloads(
                providers,
                jobs,
                reviews,
            )
            review = self.review_service.review(
                self.adapter.job_payload(job_id, claimed_job),
                provider_payloads,
            )
            latest_mode = self._mode()
            if not self._same_auto_run(mode, latest_mode):
                decision = {
                    **review["autoAssignment"],
                    "decision": "MANUAL_REVIEW",
                    "providerId": None,
                    "selectedRank": None,
                    "reasonCodes": [
                        *review["autoAssignment"].get("reasonCodes", []),
                        "AUTO_MODE_CHANGED",
                    ],
                }
                return self._mark_manual_review(job_id, decision)

            decision = review["autoAssignment"]
            provider_id = decision.get("providerId")
            if decision.get("decision") != "AUTO_ASSIGN" or not provider_id:
                return self._mark_manual_review(job_id, decision)
            provider = providers.get(provider_id)
            if not provider:
                decision = {
                    **decision,
                    "decision": "MANUAL_REVIEW",
                    "providerId": None,
                    "selectedRank": None,
                    "reasonCodes": [*decision.get("reasonCodes", []), "PROVIDER_RECORD_MISSING"],
                }
                return self._mark_manual_review(job_id, decision)

            assigned_at = _utc_now()
            assignment_audit = self._assignment_audit(
                review,
                provider_id,
                self._provider_name(provider_id, provider),
                assigned_at,
            )
            committed = self._update_claimed_job(job_id, {
                "assignedTo": provider_id,
                "assignedBy": "system:auto-assignment",
                "assignedAt": assigned_at,
                "assignmentMethod": "AUTO_AI_RECOMMENDED",
                "assignmentAudit": assignment_audit,
                "assignmentOverrideReasons": None,
                "autoAssignmentDisabled": False,
                "autoAssignmentStatus": "INDEXING",
                "autoAssignmentError": None,
                "autoAssignmentDecision": decision,
                "autoAssignmentReviewedAt": assigned_at,
                "assignmentVersion": int(claimed_job.get("assignmentVersion") or 0) + 1,
                "jobStatus": "Offered",
                "jobStatusHandyman": "Pending",
                "lastUpdated": assigned_at,
            })
            if not committed:
                return "CONFLICT"
            assigned_job = {**claimed_job, "assignedTo": provider_id}
            self._sync_indexes(assigned_job, provider_id)
            self._finalise_indexed_job(job_id, provider_id)
            return "AUTO_ASSIGNED"
        except Exception as error:
            self._mark_error(job_id, error)
            return "ERROR"
