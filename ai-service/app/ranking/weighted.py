import math
from typing import Dict, Iterable, List, Sequence, Tuple

from app.domain.models import (
    CandidateScore,
    JobInput,
    ProviderProfile,
    RankingResult,
    RejectedProvider,
    TriageResult,
)
from app.domain.skills import provider_has_required_skills, provider_skill_match_score


WEIGHTS = {
    "skillMatch": 0.35,
    "distance": 0.20,
    "availability": 0.15,
    "bayesianRating": 0.15,
    "reliability": 0.10,
    "responseFairness": 0.05,
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


class WeightedProviderRanker:
    version = "weighted-v4-category-family"

    def _score_features(
        self,
        job: JobInput,
        triage: TriageResult,
        provider: ProviderProfile,
        distance_relaxed: bool = False,
    ) -> Dict[str, float]:
        required_distance = job.latitude is not None and job.longitude is not None
        if not required_distance:
            distance_score = 0.5
        else:
            distance_km = haversine_km(job.latitude, job.longitude, provider.latitude, provider.longitude)
            if distance_relaxed:
                distance_score = min(1.0, provider.service_radius_km / max(distance_km, 0.001))
            else:
                distance_score = max(0.0, 1.0 - distance_km / provider.service_radius_km)

        prior_mean, prior_count = 4.0, 5.0
        bayesian_rating = (
            provider.average_rating * provider.review_count + prior_mean * prior_count
        ) / (provider.review_count + prior_count) / 5.0
        reliability = provider.completion_rate * (1.0 - provider.cancellation_rate)
        response = math.exp(-provider.median_response_minutes / 120.0)
        fairness = 1.0 / (1.0 + provider.active_jobs)
        return {
            "skillMatch": provider_skill_match_score(
                " ".join((job.description, *triage.extracted_issues)),
                provider.skills,
                triage.required_skills,
            ),
            "distance": distance_score,
            "availability": 1.0,
            "bayesianRating": bayesian_rating,
            "reliability": reliability,
            "responseFairness": 0.7 * response + 0.3 * fairness,
        }

    def _rejection_reasons(
        self,
        job: JobInput,
        triage: TriageResult,
        provider: ProviderProfile,
    ) -> Tuple[str, ...]:
        reasons: List[str] = []
        if not provider.verified:
            reasons.append("NOT_VERIFIED")
        if not provider.available:
            reasons.append("NOT_AVAILABLE")
        if provider.active_jobs >= provider.max_concurrent_jobs:
            reasons.append("AT_CAPACITY")
        if not provider_has_required_skills(provider.skills, triage.required_skills):
            reasons.append("MISSING_REQUIRED_SKILL")
        if job.latitude is None or job.longitude is None:
            reasons.append("JOB_LOCATION_MISSING")
        else:
            distance = haversine_km(job.latitude, job.longitude, provider.latitude, provider.longitude)
            if distance > provider.service_radius_km:
                reasons.append("OUTSIDE_SERVICE_RADIUS")
        return tuple(reasons)

    def rank(
        self,
        job: JobInput,
        triage: TriageResult,
        providers: Iterable[ProviderProfile],
        limit: int = 5,
    ) -> RankingResult:
        if triage.triage_status == "MANUAL_REVIEW" or not triage.category_id:
            return RankingResult(job.job_id, self.version)

        provisional = triage.triage_status != "READY_FOR_ASSIGNMENT"

        scored: List[Tuple[str, float, Dict[str, float], Tuple[str, ...]]] = []
        rejected: List[RejectedProvider] = []
        for provider in providers:
            rejection_reasons = self._rejection_reasons(job, triage, provider)
            if rejection_reasons:
                rejected.append(RejectedProvider(provider.provider_id, rejection_reasons))
                continue

            features = self._score_features(job, triage, provider)
            total = sum(WEIGHTS[name] * value for name, value in features.items())
            reasons = ["CATEGORY_SKILL_MATCH", "WITHIN_SERVICE_RADIUS", "AVAILABLE"]
            if features["skillMatch"] == 1.0:
                reasons.append("SPECIALTY_SKILL_MATCH")
            if provisional:
                reasons.append("PROVISIONAL_MISSING_INFORMATION")
            if provider.review_count < 5:
                reasons.append("NEW_PROVIDER_SMOOTHING_APPLIED")
            scored.append((provider.provider_id, total, features, tuple(reasons)))

        scored.sort(key=lambda row: (-row[1], row[0]))
        candidates = tuple(
            CandidateScore(
                provider_id=provider_id,
                rank=index,
                total_score=round(total, 6),
                score_breakdown={name: round(value, 6) for name, value in features.items()},
                reason_codes=reasons,
            )
            for index, (provider_id, total, features, reasons) in enumerate(scored[:limit], start=1)
        )

        alternatives: Tuple[CandidateScore, ...] = ()
        if not candidates:
            distance_only = {"JOB_LOCATION_MISSING", "OUTSIDE_SERVICE_RADIUS"}
            alternative_rows: List[Tuple[str, float, Dict[str, float], Tuple[str, ...]]] = []
            for provider in providers:
                rejection_reasons = self._rejection_reasons(job, triage, provider)
                if not rejection_reasons or not set(rejection_reasons).issubset(distance_only):
                    continue
                features = self._score_features(job, triage, provider, distance_relaxed=True)
                total = sum(WEIGHTS[name] * value for name, value in features.items())
                reasons = (
                    "CATEGORY_SKILL_MATCH",
                    "VERIFIED",
                    "AVAILABLE",
                    "CAPACITY_AVAILABLE",
                    "DISTANCE_REQUIREMENT_RELAXED",
                    *rejection_reasons,
                )
                alternative_rows.append((provider.provider_id, total, features, reasons))
            alternative_rows.sort(key=lambda row: (-row[1], row[0]))
            alternatives = tuple(
                CandidateScore(
                    provider_id=provider_id,
                    rank=index,
                    total_score=round(total, 6),
                    score_breakdown={name: round(value, 6) for name, value in features.items()},
                    reason_codes=reasons,
                )
                for index, (provider_id, total, features, reasons)
                in enumerate(alternative_rows[:limit], start=1)
            )
        rejected.sort(key=lambda item: item.provider_id)
        return RankingResult(job.job_id, self.version, candidates, alternatives, tuple(rejected))
