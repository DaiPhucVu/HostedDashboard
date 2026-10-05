from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass(frozen=True)
class JobInput:
    job_id: str
    description: str
    category_hint: Optional[str] = None
    language_hint: Optional[str] = None
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "JobInput":
        return cls(
            job_id=data["jobId"],
            description=data.get("description", ""),
            category_hint=data.get("categoryHint"),
            language_hint=data.get("languageHint"),
            location_text=data.get("locationText"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            start_at=data.get("startAt"),
            end_at=data.get("endAt"),
            budget_min=data.get("budgetMin"),
            budget_max=data.get("budgetMax"),
        )


@dataclass(frozen=True)
class ProviderProfile:
    provider_id: str
    display_name: str
    verified: bool
    skills: Tuple[str, ...]
    languages: Tuple[str, ...]
    available: bool
    latitude: float
    longitude: float
    service_radius_km: float
    active_jobs: int
    max_concurrent_jobs: int
    average_rating: float
    review_count: int
    completion_rate: float
    cancellation_rate: float
    median_response_minutes: float
    years_experience: float = 0.0
    years_experience_recorded: bool = False
    completed_jobs: int = 0
    completed_jobs_by_category: Dict[str, int] = field(default_factory=dict)
    provider_cancelled_jobs: int = 0
    location_source: str = "RECORDED_COORDINATES"
    service_radius_recorded: bool = True
    availability_recorded: bool = True
    capacity_recorded: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProviderProfile":
        return cls(
            provider_id=data["providerId"],
            display_name=data.get("displayName", data["providerId"]),
            verified=bool(data["verified"]),
            skills=tuple(data.get("skills", [])),
            languages=tuple(data.get("languages", [])),
            available=bool(data["available"]),
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            service_radius_km=float(data["serviceRadiusKm"]),
            active_jobs=int(data["activeJobs"]),
            max_concurrent_jobs=int(data["maxConcurrentJobs"]),
            average_rating=float(data["averageRating"]),
            review_count=int(data["reviewCount"]),
            completion_rate=float(data["completionRate"]),
            cancellation_rate=float(data["cancellationRate"]),
            median_response_minutes=float(data["medianResponseMinutes"]),
            years_experience=float(data.get("yearsExperience", 0)),
            years_experience_recorded=bool(
                data.get("yearsExperienceRecorded", "yearsExperience" in data)
            ),
            completed_jobs=int(data.get("completedJobs", 0)),
            completed_jobs_by_category={
                str(category): int(count)
                for category, count in data.get("completedJobsByCategory", {}).items()
            },
            provider_cancelled_jobs=int(data.get("providerCancelledJobs", 0)),
            location_source=str(
                data.get("locationSource", "RECORDED_COORDINATES")
            ),
            service_radius_recorded=bool(data.get("serviceRadiusRecorded", True)),
            availability_recorded=bool(data.get("availabilityRecorded", True)),
            capacity_recorded=bool(data.get("capacityRecorded", True)),
        )


@dataclass(frozen=True)
class KnowledgeDocument:
    doc_id: str
    category_id: str
    title: str
    body: str
    keywords: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeDocument":
        return cls(
            doc_id=data["docId"],
            category_id=data["categoryId"],
            title=data["title"],
            body=data["body"],
            keywords=data.get("keywords", ""),
        )


@dataclass(frozen=True)
class AssignmentCommand:
    job_id: str
    provider_id: str
    actor_id: str
    expected_job_version: int
    idempotency_key: str
    ranking_version: Optional[str] = None
    selected_rank: Optional[int] = None
    override_reason: Optional[str] = None


@dataclass(frozen=True)
class AssignmentCancellationCommand:
    job_id: str
    assignment_id: str
    actor_id: str
    expected_job_version: int
    reason: Optional[str] = None


@dataclass(frozen=True)
class AssignmentRecord:
    assignment_id: str
    job_id: str
    provider_id: str
    status: str
    job_version: int
    idempotency_key: str

    def to_contract_dict(self) -> Dict[str, Any]:
        return {
            "assignmentId": self.assignment_id,
            "jobId": self.job_id,
            "providerId": self.provider_id,
            "status": self.status,
            "jobVersion": self.job_version,
            "idempotencyKey": self.idempotency_key,
        }


@dataclass(frozen=True)
class TriageResult:
    job_id: str
    triage_status: str
    category_id: Optional[str]
    urgency: str
    required_skills: Tuple[str, ...]
    missing_fields: Tuple[str, ...]
    confidence: float
    evidence_doc_ids: Tuple[str, ...]
    reason_codes: Tuple[str, ...]
    issue_summary: str = ""
    extracted_issues: Tuple[str, ...] = field(default_factory=tuple)
    language: str = "unknown"
    safety_flags: Tuple[str, ...] = field(default_factory=tuple)
    model_version: str = "rules-bm25-v1"
    original_category: Optional[str] = None
    semantic_category: Optional[str] = None
    final_category: Optional[str] = None
    category_decision: str = "RULE_CLASSIFICATION"
    override_reason: Optional[str] = None

    def to_contract_dict(self) -> Dict[str, Any]:
        return {
            "jobId": self.job_id,
            "triageStatus": self.triage_status,
            "categoryId": self.category_id,
            "urgency": self.urgency,
            "requiredSkills": list(self.required_skills),
            "missingFields": list(self.missing_fields),
            "confidence": self.confidence,
            "evidenceDocIds": list(self.evidence_doc_ids),
            "reasonCodes": list(self.reason_codes),
            "issueSummary": self.issue_summary,
            "extractedIssues": list(self.extracted_issues),
            "language": self.language,
            "safetyFlags": list(self.safety_flags),
            "modelVersion": self.model_version,
            "originalCategory": self.original_category,
            "semanticCategory": self.semantic_category,
            "finalCategory": self.final_category or self.category_id,
            "categoryDecision": self.category_decision,
            "overrideReason": self.override_reason,
        }


@dataclass(frozen=True)
class CandidateScore:
    provider_id: str
    rank: int
    total_score: float
    score_breakdown: Dict[str, float]
    reason_codes: Tuple[str, ...]
    evidence: Dict[str, Any] = field(default_factory=dict)

    def to_contract_dict(self) -> Dict[str, Any]:
        return {
            "providerId": self.provider_id,
            "rank": self.rank,
            "totalScore": self.total_score,
            "scoreBreakdown": self.score_breakdown,
            "reasonCodes": list(self.reason_codes),
            "evidence": self.evidence,
        }


@dataclass(frozen=True)
class RejectedProvider:
    provider_id: str
    reason_codes: Tuple[str, ...]

    def to_contract_dict(self) -> Dict[str, Any]:
        return {"providerId": self.provider_id, "reasonCodes": list(self.reason_codes)}


@dataclass(frozen=True)
class RankingResult:
    job_id: str
    ranking_version: str
    candidates: Tuple[CandidateScore, ...] = field(default_factory=tuple)
    alternatives: Tuple[CandidateScore, ...] = field(default_factory=tuple)
    rejected: Tuple[RejectedProvider, ...] = field(default_factory=tuple)

    def to_contract_dict(self) -> Dict[str, Any]:
        return {
            "jobId": self.job_id,
            "rankingVersion": self.ranking_version,
            "candidates": [item.to_contract_dict() for item in self.candidates],
            "alternatives": [item.to_contract_dict() for item in self.alternatives],
            "rejected": [item.to_contract_dict() for item in self.rejected],
        }


@dataclass(frozen=True)
class AutoAssignmentDecision:
    decision: str
    provider_id: Optional[str]
    selected_rank: Optional[int]
    score: Optional[float]
    runner_up_score: Optional[float]
    score_margin: Optional[float]
    minimum_score: float
    minimum_margin: float
    reason_codes: Tuple[str, ...]

    def to_contract_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision,
            "providerId": self.provider_id,
            "selectedRank": self.selected_rank,
            "score": self.score,
            "runnerUpScore": self.runner_up_score,
            "scoreMargin": self.score_margin,
            "minimumScore": self.minimum_score,
            "minimumMargin": self.minimum_margin,
            "reasonCodes": list(self.reason_codes),
        }
