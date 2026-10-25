import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.domain.skills import CATEGORY_SKILL_ALIASES, normalise_skill
from app.triage.rules import load_taxonomy


AREA_COORDINATES = {
    "banani": (23.7937, 90.4066),
    "dhanmondi": (23.7461, 90.3742),
    "gulshan": (23.7925, 90.4078),
    "uttara": (23.8759, 90.3795),
    "mirpur": (23.8223, 90.3654),
    "mohammadpur": (23.7588, 90.3630),
    "badda": (23.7806, 90.4267),
    "tejgaon": (23.7630, 90.4010),
    "dhaka": (23.8103, 90.4125),
}
DEFAULT_PROVIDER_COORDINATES = (23.8103, 90.4125)
COMPLETED_STATUSES = {"done", "completed", "complete"}
CANCELLED_STATUSES = {"cancelled", "canceled"}
INACTIVE_STATUSES = {"inactive"}
PROVIDER_WORKLOAD_LIMIT = 3


def _normalise_label(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()


def _number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _list_values(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, dict):
        return [str(key) for key, enabled in value.items() if enabled]
    if isinstance(value, (list, tuple, set)):
        result: List[str] = []
        for item in value:
            result.extend(_list_values(item))
        return result
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _assigned_provider_id(job: Dict[str, Any]) -> str:
    assignment = job.get("assignment") or {}
    return str(
        job.get("assignedTo")
        or assignment.get("providerId")
        or assignment.get("assignedTo")
        or ""
    )


class FirebaseDataAdapter:
    def __init__(self, taxonomy_path: Path):
        taxonomy = load_taxonomy(taxonomy_path)
        self.categories = {item["id"]: item for item in taxonomy["categories"]}
        self.category_aliases: Dict[str, str] = {}
        for category_id, item in self.categories.items():
            for value in (category_id, item["labelEn"]):
                self.category_aliases[_normalise_label(value)] = category_id
        self.category_aliases.update({
            "cleaning solution": "cleaning",
            "painting renovation": "painting",
            "beauty wellness": "beauty_wellness",
            "mens care salon": "mens_care_salon",
            "health care": "health_care",
            "electronics gadgets repair": "electronics_repair",
            "electronics gadget repair": "electronics_repair",
            "car care services": "car_care",
            "trips travels": "trips_travel",
            "trips travel": "trips_travel",
            "emergency services": "emergency_service",
        })

    def canonical_category(self, job: Dict[str, Any]) -> Optional[str]:
        raw = _normalise_label(job.get("jobCat") or job.get("category"))
        if raw in {"electric plumbing", "electric and plumbing", "electric plumbing services"}:
            description = _normalise_label(job.get("jobDesc") or job.get("description"))
            if re.search(r"\b(pipe|tap|faucet|leak|drain|toilet|plumb)\b", description):
                return "plumbing"
            if re.search(r"\b(power|socket|outlet|wire|spark|electric|light|switch)\b", description):
                return "electrical"
            return None
        return self.category_aliases.get(raw)

    @staticmethod
    def _coordinates(
        record: Dict[str, Any],
        default: Optional[Tuple[float, float]],
    ) -> Tuple[Optional[float], Optional[float], str]:
        latitude = _number(record.get("latitude"))
        longitude = _number(record.get("longitude"))
        if (
            latitude is not None
            and longitude is not None
            and (latitude != 0 or longitude != 0)
        ):
            return latitude, longitude, "RECORDED_COORDINATES"
        area = _normalise_label(
            record.get("area")
            or record.get("city")
            or record.get("thana")
            or record.get("jobLocation")
            or record.get("location")
        )
        for known_area, coordinates in AREA_COORDINATES.items():
            if known_area in area:
                return *coordinates, "AREA_CENTROID"
        if default is None:
            return None, None, "MISSING"
        return *default, "POLICY_DEFAULT_COORDINATES"

    def job_payload(self, job_id: str, job: Dict[str, Any]) -> Dict[str, Any]:
        location_text = job.get("jobLocation") or job.get("location") or None
        latitude, longitude, _ = self._coordinates(job, None)
        budget_min = _number(job.get("jobSalaryFrom"))
        budget_max = _number(job.get("jobSalaryTo"))
        return {
            "jobId": job_id,
            "description": str(job.get("jobDesc") or job.get("description") or ""),
            "categoryHint": self.canonical_category(job),
            "languageHint": None,
            "locationText": location_text,
            "latitude": latitude,
            "longitude": longitude,
            "startAt": job.get("jobDateFrom") or None,
            "endAt": job.get("jobDateTo") or None,
            "budgetMin": budget_min,
            "budgetMax": budget_max,
        }

    def _canonical_skills(self, provider: Dict[str, Any]) -> List[str]:
        values: List[str] = []
        for field in (
            "skills", "primaryTrade", "trade", "serviceCategory", "category",
            "specialties", "specialisations",
        ):
            values.extend(_list_values(provider.get(field)))
        description = " ".join(
            str(provider.get(field) or "")
            for field in ("bio", "skillDescription", "expertise")
        ).casefold()
        result = set()
        for value in values:
            token = normalise_skill(value)
            if token:
                result.add(token)
            for category_id, aliases in CATEGORY_SKILL_ALIASES.items():
                if token in aliases:
                    result.add(category_id)
        for category_id, aliases in CATEGORY_SKILL_ALIASES.items():
            for alias in aliases:
                phrase = alias.replace("_", " ")
                if phrase and phrase in description:
                    result.update((category_id, alias))
        return sorted(result)

    def _history(
        self,
        provider_id: str,
        jobs: Dict[str, Dict[str, Any]],
        reviews: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        provider_jobs = [
            {"jobId": job_id, **(job or {})}
            for job_id, job in jobs.items()
            if _assigned_provider_id(job or {}) == provider_id
        ]
        completed = [
            job for job in provider_jobs
            if _normalise_label(job.get("jobStatus") or job.get("status")) in COMPLETED_STATUSES
        ]
        completed_ids = {job["jobId"] for job in completed}
        by_category = Counter(
            category
            for job in completed
            if (category := self.canonical_category(job))
        )
        provider_cancelled = 0
        for job in provider_jobs:
            status = _normalise_label(job.get("jobStatus") or job.get("status"))
            if status not in CANCELLED_STATUSES:
                continue
            assignment = job.get("assignment") or {}
            cancellation = job.get("cancellation") or {}
            actor = _normalise_label(
                job.get("cancelledByType")
                or job.get("canceledByType")
                or cancellation.get("actorType")
                or assignment.get("cancelledByType")
            )
            if actor in {"provider", "handyman", "worker"}:
                provider_cancelled += 1
        active_jobs = sum(
            1
            for job in provider_jobs
            if _normalise_label(job.get("jobStatus") or job.get("status"))
            not in COMPLETED_STATUSES | CANCELLED_STATUSES | INACTIVE_STATUSES
        )
        ratings = []
        for review in reviews.values():
            if str((review or {}).get("handymanId") or "") != provider_id:
                continue
            if _normalise_label((review or {}).get("reviewerType")) != "customer":
                continue
            if (review or {}).get("jobId") not in completed_ids:
                continue
            rating = _number((review or {}).get("rating"))
            if rating is not None and 1 <= rating <= 5:
                ratings.append(rating)
        return {
            "completedJobs": len(completed),
            "completedJobsByCategory": dict(sorted(by_category.items())),
            "providerCancelledJobs": provider_cancelled,
            "activeJobs": active_jobs,
            "averageRating": sum(ratings) / len(ratings) if ratings else 0.0,
            "reviewCount": len(ratings),
        }

    def provider_payloads(
        self,
        providers: Dict[str, Dict[str, Any]],
        jobs: Dict[str, Dict[str, Any]],
        reviews: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        payloads = []
        for provider_id, provider_value in sorted(providers.items()):
            provider = provider_value or {}
            history = self._history(provider_id, jobs, reviews)
            status = _normalise_label(provider.get("verificationStatus"))
            verified = (
                status in {"approved", "verified", "active"}
                or provider.get("verified") is True
                or provider.get("verified") == "true"
            ) and status not in {"declined", "rejected", "pending", "suspended", "inactive"}
            availability_status = _normalise_label(
                provider.get("availabilityStatus") or provider.get("status")
            )
            recorded_available = provider.get("available")
            available = (
                recorded_available is not False
                and str(recorded_available).casefold() != "false"
                and availability_status not in {"unavailable", "inactive", "suspended"}
            )
            latitude, longitude, location_source = self._coordinates(
                provider,
                DEFAULT_PROVIDER_COORDINATES,
            )
            radius = _number(provider.get("serviceRadiusKm"))
            experience = _number(provider.get("experienceYears"))
            outcome_jobs = history["completedJobs"] + history["providerCancelledJobs"]
            payloads.append({
                "providerId": str(provider.get("handymanId") or provider.get("id") or provider_id),
                "displayName": (
                    f"{provider.get('firstName', '')} {provider.get('lastName', '')}".strip()
                    or str(provider.get("displayName") or provider.get("email") or provider_id)
                ),
                "verified": verified,
                "skills": self._canonical_skills(provider),
                "languages": sorted(set(_list_values(provider.get("languages") or ["bn", "en"]))),
                "available": available,
                "latitude": latitude,
                "longitude": longitude,
                "serviceRadiusKm": radius if radius and radius > 0 else 25.0,
                "activeJobs": history["activeJobs"],
                "maxConcurrentJobs": PROVIDER_WORKLOAD_LIMIT,
                "averageRating": history["averageRating"],
                "reviewCount": history["reviewCount"],
                "completionRate": history["completedJobs"] / outcome_jobs if outcome_jobs else 0.0,
                "cancellationRate": history["providerCancelledJobs"] / outcome_jobs if outcome_jobs else 0.0,
                "medianResponseMinutes": max(0.0, _number(provider.get("medianResponseMinutes")) or 0.0),
                "yearsExperience": max(0.0, experience or 0.0),
                "yearsExperienceRecorded": experience is not None,
                "completedJobs": history["completedJobs"],
                "completedJobsByCategory": history["completedJobsByCategory"],
                "providerCancelledJobs": history["providerCancelledJobs"],
                "locationSource": location_source,
                "serviceRadiusRecorded": bool(radius and radius > 0),
                "availabilityRecorded": True,
                "capacityRecorded": True,
            })
        return payloads
