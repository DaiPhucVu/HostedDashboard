import math
from typing import Any, Dict, Iterable, List, Tuple

from app.domain.models import (
    CandidateScore,
    JobInput,
    ProviderProfile,
    RankingResult,
    RejectedProvider,
    TriageResult,
)
from app.domain.skills import (
    provider_has_required_skills,
    provider_skill_categories,
    provider_skill_match_score,
)


WEIGHTS = {
    "relevantExperience": 0.45,
    "rating": 0.20,
    "reliability": 0.20,
    "availability": 0.05,
    "distance": 0.10,
}

RELEVANT_EXPERIENCE_WEIGHTS = {
    "specialtyMatch": 0.30,
    "yearsExperience": 0.05,
    "categoryJobs": 0.65,
}

RATING_NEUTRAL_PRIOR = 0.60
RATING_PRIOR_COUNT = 5
RELIABILITY_NEUTRAL_PRIOR = 0.70
RELIABILITY_PRIOR_COUNT = 10
YEARS_EXPERIENCE_CAP = 20
MAX_DECLARED_EXPERIENCE_YEARS = 50
CATEGORY_JOBS_CAP = 20


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, value))


class WeightedProviderRanker:
    version = "weighted-v9-history-cap20"

    def _score_features(
        self,
        job: JobInput,
        triage: TriageResult,
        provider: ProviderProfile,
        distance_relaxed: bool = False,
    ) -> Tuple[Dict[str, float], Dict[str, Any], Tuple[str, ...]]:
        distance_km = None
        distance_is_recorded = (
            provider.location_source == "RECORDED_COORDINATES"
            and provider.service_radius_recorded
        )
        if job.latitude is None or job.longitude is None:
            distance_score = 0.5
        else:
            distance_km = haversine_km(
                job.latitude,
                job.longitude,
                provider.latitude,
                provider.longitude,
            )
            if not distance_is_recorded:
                distance_score = 0.5
            elif distance_relaxed:
                distance_score = min(
                    1.0,
                    provider.service_radius_km / max(distance_km, 0.001),
                )
            else:
                distance_score = _bounded(
                    1.0 - distance_km / provider.service_radius_km
                )

        category_jobs = max(
            0,
            int(provider.completed_jobs_by_category.get(triage.category_id or "", 0)),
        )
        specialty_match = provider_skill_match_score(
            " ".join((job.description, *triage.extracted_issues)),
            provider.skills,
            triage.required_skills,
        )
        profile_skill_categories = provider_skill_categories(provider.skills)
        if (
            specialty_match == 0.0
            and category_jobs > 0
            and not profile_skill_categories
        ):
            specialty_match = 0.7
        experience_is_valid = (
            provider.years_experience_recorded
            and provider.years_experience <= MAX_DECLARED_EXPERIENCE_YEARS
        )
        years_score = _bounded(
            provider.years_experience / YEARS_EXPERIENCE_CAP
        ) if experience_is_valid else 0.0
        category_jobs_score = min(
            1.0,
            math.log1p(category_jobs) / math.log1p(CATEGORY_JOBS_CAP),
        )
        relevant_experience = (
            RELEVANT_EXPERIENCE_WEIGHTS["specialtyMatch"] * specialty_match
            + RELEVANT_EXPERIENCE_WEIGHTS["yearsExperience"] * years_score
            + RELEVANT_EXPERIENCE_WEIGHTS["categoryJobs"] * category_jobs_score
        )

        rating_uses_prior = provider.review_count <= 0
        if rating_uses_prior:
            rating_score = RATING_NEUTRAL_PRIOR
        else:
            prior_stars = RATING_NEUTRAL_PRIOR * 5.0
            rating_score = (
                provider.average_rating * provider.review_count
                + prior_stars * RATING_PRIOR_COUNT
            ) / (provider.review_count + RATING_PRIOR_COUNT) / 5.0

        outcome_jobs = provider.completed_jobs + provider.provider_cancelled_jobs
        reliability_uses_prior = outcome_jobs <= 0
        prior_completed = RELIABILITY_NEUTRAL_PRIOR * RELIABILITY_PRIOR_COUNT
        reliability_score = (
            provider.completed_jobs + prior_completed
        ) / (outcome_jobs + RELIABILITY_PRIOR_COUNT)
        if provider.capacity_recorded:
            availability_score = _bounded(
                1.0 - 0.5 * provider.active_jobs / provider.max_concurrent_jobs
            )
            workload_scoring_method = "CAPACITY_RATIO"
        else:
            availability_score = max(0.2, 1.0 - 0.2 * provider.active_jobs)
            workload_scoring_method = "ACTIVE_JOB_COUNT"

        features = {
            "skillMatch": specialty_match,
            "relevantExperience": relevant_experience,
            "rating": _bounded(rating_score),
            "reliability": _bounded(reliability_score),
            "availability": availability_score,
            "distance": distance_score,
        }
        evidence = {
            "profileExperience": {
                "source": "HANDYMAN_PROFILE",
                "yearsExperience": provider.years_experience,
                "recorded": provider.years_experience_recorded,
                "valid": experience_is_valid,
            },
            "categoryExperience": {
                "source": "JOB_HISTORY",
                "categoryId": triage.category_id,
                "completedJobs": category_jobs,
                "totalCompletedJobs": provider.completed_jobs,
            },
            "rating": {
                "source": "NEUTRAL_PRIOR" if rating_uses_prior else "CUSTOMER_REVIEWS",
                "averageRating": provider.average_rating if provider.review_count else None,
                "reviewCount": provider.review_count,
                "usedNeutralPrior": rating_uses_prior,
            },
            "reliability": {
                "source": "NEUTRAL_PRIOR" if reliability_uses_prior else "JOB_HISTORY",
                "completedJobs": provider.completed_jobs,
                "providerCancelledJobs": provider.provider_cancelled_jobs,
                "usedNeutralPrior": reliability_uses_prior,
            },
            "availability": {
                "source": "CURRENT_JOB_HISTORY",
                "activeJobs": provider.active_jobs,
                "maxConcurrentJobs": provider.max_concurrent_jobs,
                "availabilityRecorded": provider.availability_recorded,
                "capacityRecorded": provider.capacity_recorded,
                "scoringMethod": workload_scoring_method,
            },
            "distance": {
                "source": "JOB_AND_PROVIDER_COORDINATES",
                "distanceKm": None if distance_km is None else round(distance_km, 3),
                "serviceRadiusKm": provider.service_radius_km,
                "providerLocationSource": provider.location_source,
                "serviceRadiusRecorded": provider.service_radius_recorded,
                "usedNeutralPrior": not distance_is_recorded,
                "requirementRelaxed": distance_relaxed,
            },
        }
        reasons: List[str] = []
        if rating_uses_prior:
            reasons.append("RATING_NEUTRAL_PRIOR")
        if reliability_uses_prior:
            reasons.append("RELIABILITY_NEUTRAL_PRIOR")
        if rating_uses_prior and reliability_uses_prior:
            reasons.append("NEW_PROVIDER_LIMITED_HISTORY")
        if provider.years_experience_recorded and not experience_is_valid:
            reasons.append("DECLARED_EXPERIENCE_INVALID")
        if not provider.capacity_recorded:
            reasons.append("CAPACITY_NOT_RECORDED")
        if not distance_is_recorded:
            reasons.append("DISTANCE_NEUTRAL_PRIOR")
        return features, evidence, tuple(reasons)

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
        if (
            provider.capacity_recorded
            and provider.active_jobs >= provider.max_concurrent_jobs
        ):
            reasons.append("AT_CAPACITY")
        has_category_history = bool(
            triage.category_id
            and provider.completed_jobs_by_category.get(triage.category_id, 0) > 0
            and not provider_skill_categories(provider.skills)
        )
        if (
            not provider_has_required_skills(provider.skills, triage.required_skills)
            and not has_category_history
        ):
            reasons.append("MISSING_REQUIRED_SKILL")
        if job.latitude is None or job.longitude is None:
            reasons.append("JOB_LOCATION_MISSING")
        elif (
            provider.location_source == "RECORDED_COORDINATES"
            and provider.service_radius_recorded
        ):
            distance = haversine_km(
                job.latitude,
                job.longitude,
                provider.latitude,
                provider.longitude,
            )
            if distance > provider.service_radius_km:
                reasons.append("OUTSIDE_SERVICE_RADIUS")
        return tuple(reasons)

    @staticmethod
    def _total(features: Dict[str, float]) -> float:
        return sum(WEIGHTS[name] * features[name] for name in WEIGHTS)

    def rank(
        self,
        job: JobInput,
        triage: TriageResult,
        providers: Iterable[ProviderProfile],
        limit: int = 5,
    ) -> RankingResult:
        if triage.triage_status == "MANUAL_REVIEW" or not triage.category_id:
            return RankingResult(job.job_id, self.version)

        providers = tuple(providers)
        provisional = triage.triage_status != "READY_FOR_ASSIGNMENT"
        scored: List[
            Tuple[str, float, Dict[str, float], Tuple[str, ...], Dict[str, Any]]
        ] = []
        rejected: List[RejectedProvider] = []
        for provider in providers:
            rejection_reasons = self._rejection_reasons(job, triage, provider)
            if rejection_reasons:
                rejected.append(RejectedProvider(provider.provider_id, rejection_reasons))
                continue

            features, evidence, feature_reasons = self._score_features(job, triage, provider)
            total = self._total(features)
            reasons = ["CATEGORY_SKILL_MATCH"]
            reasons.append(
                "AVAILABLE" if provider.availability_recorded
                else "AVAILABILITY_DATA_LIMITED"
            )
            reasons.append(
                "WITHIN_SERVICE_RADIUS"
                if provider.location_source == "RECORDED_COORDINATES"
                and provider.service_radius_recorded
                else "DISTANCE_DATA_LIMITED"
            )
            if features["skillMatch"] == 1.0:
                reasons.append("SPECIALTY_SKILL_MATCH")
            if provisional:
                reasons.append("PROVISIONAL_MISSING_INFORMATION")
            reasons.extend(feature_reasons)
            scored.append((provider.provider_id, total, features, tuple(reasons), evidence))

        scored.sort(key=lambda row: (-row[1], row[0]))
        candidates = tuple(
            CandidateScore(
                provider_id=provider_id,
                rank=index,
                total_score=round(total, 6),
                score_breakdown={name: round(value, 6) for name, value in features.items()},
                reason_codes=reasons,
                evidence=evidence,
            )
            for index, (provider_id, total, features, reasons, evidence)
            in enumerate(scored[:limit], start=1)
        )

        alternatives: Tuple[CandidateScore, ...] = ()
        if not candidates:
            distance_only = {"JOB_LOCATION_MISSING", "OUTSIDE_SERVICE_RADIUS"}
            alternative_rows: List[
                Tuple[str, float, Dict[str, float], Tuple[str, ...], Dict[str, Any]]
            ] = []
            for provider in providers:
                rejection_reasons = self._rejection_reasons(job, triage, provider)
                if not rejection_reasons or not set(rejection_reasons).issubset(distance_only):
                    continue
                features, evidence, feature_reasons = self._score_features(
                    job,
                    triage,
                    provider,
                    distance_relaxed=True,
                )
                total = self._total(features)
                reasons = (
                    "CATEGORY_SKILL_MATCH",
                    "VERIFIED",
                    "AVAILABLE",
                    "CAPACITY_AVAILABLE",
                    "DISTANCE_REQUIREMENT_RELAXED",
                    *feature_reasons,
                    *rejection_reasons,
                )
                alternative_rows.append(
                    (provider.provider_id, total, features, reasons, evidence)
                )
            alternative_rows.sort(key=lambda row: (-row[1], row[0]))
            alternatives = tuple(
                CandidateScore(
                    provider_id=provider_id,
                    rank=index,
                    total_score=round(total, 6),
                    score_breakdown={name: round(value, 6) for name, value in features.items()},
                    reason_codes=reasons,
                    evidence=evidence,
                )
                for index, (provider_id, total, features, reasons, evidence)
                in enumerate(alternative_rows[:limit], start=1)
            )
        rejected.sort(key=lambda item: item.provider_id)
        return RankingResult(job.job_id, self.version, candidates, alternatives, tuple(rejected))
