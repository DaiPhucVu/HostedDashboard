from dataclasses import dataclass
from typing import Iterable

from app.domain.models import (
    AutoAssignmentDecision,
    JobInput,
    ProviderProfile,
    RankingResult,
    TriageResult,
)


@dataclass(frozen=True)
class AutoAssignmentPolicy:
    minimum_score: float = 0.60
    minimum_margin: float = 0.0


class AutoAssignmentDecisionService:
    """Choose rank one or require review."""

    def __init__(self, policy: AutoAssignmentPolicy = AutoAssignmentPolicy()):
        self.policy = policy

    def decide(
        self,
        job: JobInput,
        triage: TriageResult,
        ranking: RankingResult,
        providers: Iterable[ProviderProfile],
    ) -> AutoAssignmentDecision:
        provider_by_id = {provider.provider_id: provider for provider in providers}
        reasons = []

        if triage.triage_status != "READY_FOR_ASSIGNMENT":
            reasons.append("TRIAGE_NOT_READY")
        if "CATEGORY_SEMANTIC_CONFLICT" in triage.reason_codes:
            reasons.append("CATEGORY_SEMANTIC_CONFLICT")
        if not triage.category_id:
            reasons.append("CATEGORY_MISSING")
        top = ranking.candidates[0] if ranking.candidates else None
        if top is None:
            reasons.append("NO_ELIGIBLE_PROVIDER")
            return self._manual_review(reasons)

        provider = provider_by_id.get(top.provider_id)
        if provider is None:
            reasons.append("PROVIDER_RECORD_MISSING")

        runner_up = ranking.candidates[1] if len(ranking.candidates) > 1 else None
        margin = None if runner_up is None else round(
            top.total_score - runner_up.total_score,
            6,
        )
        if top.total_score <= self.policy.minimum_score:
            reasons.append("TOP_SCORE_BELOW_THRESHOLD")

        if reasons:
            return self._manual_review(
                reasons,
                top.provider_id,
                top.rank,
                top.total_score,
                runner_up.total_score if runner_up else None,
                margin,
            )
        return AutoAssignmentDecision(
            decision="AUTO_ASSIGN",
            provider_id=top.provider_id,
            selected_rank=top.rank,
            score=top.total_score,
            runner_up_score=runner_up.total_score if runner_up else None,
            score_margin=margin,
            minimum_score=self.policy.minimum_score,
            minimum_margin=self.policy.minimum_margin,
            reason_codes=("ALL_AUTO_ASSIGN_GATES_PASSED",),
        )

    def _manual_review(
        self,
        reasons,
        provider_id=None,
        selected_rank=None,
        score=None,
        runner_up_score=None,
        score_margin=None,
    ) -> AutoAssignmentDecision:
        return AutoAssignmentDecision(
            decision="MANUAL_REVIEW",
            provider_id=provider_id,
            selected_rank=selected_rank,
            score=score,
            runner_up_score=runner_up_score,
            score_margin=score_margin,
            minimum_score=self.policy.minimum_score,
            minimum_margin=self.policy.minimum_margin,
            reason_codes=tuple(dict.fromkeys(reasons)),
        )
