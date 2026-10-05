import json
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.domain.models import JobInput, TriageResult
from app.retrieval.fts5 import Fts5KnowledgeIndex, normalize_text


CRITICAL_TERMS = (
    "fire",
    "smoke",
    "gas leak",
    "electrocution",
    "আগুন",
    "ধোঁয়া",
    "গ্যাস লিক",
    "বিদ্যুৎস্পৃষ্ট",
)

HIGH_TERMS = (
    "urgent",
    "immediately",
    "as soon as possible",
    "sparking",
    "burning smell",
    "burst pipe",
    "flooding",
    "no power",
    "স্পার্ক",
    "পোড়া গন্ধ",
    "পাইপ ফেটে",
    "পানি ঢুকছে",
    "জরুরি",
    "এখনই",
    "current nai",
)

# A short or unspecific description reduces certainty about the exact work, but
# it should not hide providers when the broad service category is already known.
# Location and schedule are still required before an AI-recommended assignment.
ASSIGNMENT_BLOCKING_MISSING_FIELDS = frozenset({"location", "schedule"})


def triage_status_for(
    category_id: Optional[str],
    confidence: float,
    missing_fields: Iterable[str],
) -> str:
    if category_id is None or confidence < 0.60:
        return "MANUAL_REVIEW"
    if ASSIGNMENT_BLOCKING_MISSING_FIELDS.intersection(missing_fields):
        return "NEEDS_INFO"
    return "READY_FOR_ASSIGNMENT"


def load_taxonomy(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _contains(text: str, terms: Iterable[str]) -> bool:
    return any(normalize_text(term) in text for term in terms)


def _matchable_text(value: str) -> str:
    normalized = normalize_text(value)
    characters = [
        char if unicodedata.category(char)[0] in {"L", "M", "N"} else " "
        for char in normalized
    ]
    return " ".join("".join(characters).split())


def _matches_phrase(text: str, phrase: str) -> bool:
    value = _matchable_text(phrase)
    return bool(value) and " {} ".format(value) in " {} ".format(text)


def detect_language(text: str) -> str:
    has_bangla = any("\u0980" <= char <= "\u09ff" for char in text)
    has_latin = any("a" <= char.casefold() <= "z" for char in text)
    if has_bangla and has_latin:
        return "mixed"
    if has_bangla:
        return "bn"
    if has_latin:
        return "en"
    return "unknown"


class RuleTriageService:
    def __init__(self, taxonomy: Dict[str, Any], index: Fts5KnowledgeIndex):
        self.taxonomy = taxonomy
        self.index = index

    def description_category(
        self,
        description: str,
    ) -> Tuple[Optional[str], Tuple[str, ...]]:
        text = _matchable_text(description)
        scored: List[Tuple[int, str, Tuple[str, ...]]] = []
        for category in self.taxonomy["categories"]:
            hits = tuple(
                keyword
                for keyword in category["keywords"]
                if _matches_phrase(text, keyword)
            )
            scored.append((len(hits), category["id"], hits))
        scored.sort(key=lambda row: (-row[0], row[1]))
        best_count = scored[0][0]
        if best_count == 0 or sum(row[0] == best_count for row in scored) > 1:
            return None, tuple()
        return scored[0][1], scored[0][2]

    def _category(self, job: JobInput) -> Tuple[Optional[str], Tuple[str, ...], float, Tuple[str, ...]]:
        category_by_id = {
            normalize_text(category["id"]): category
            for category in self.taxonomy["categories"]
        }
        category_hint = normalize_text(job.category_hint or "")
        if category_hint in category_by_id:
            category = category_by_id[category_hint]
            return (
                category["id"],
                tuple(category["requiredSkills"]),
                0.90,
                tuple(),
            )

        category_id, hits = self.description_category(
            " ".join(filter(None, [job.category_hint, job.description]))
        )
        if category_id is None:
            return None, tuple(), 0.30, tuple()
        best_count = len(hits)
        confidence = min(0.95, 0.62 + 0.10 * (best_count - 1))
        required = next(
            tuple(category["requiredSkills"])
            for category in self.taxonomy["categories"]
            if category["id"] == category_id
        )
        return category_id, required, confidence, tuple(hits)

    def triage(self, job: JobInput) -> TriageResult:
        normalized = normalize_text(job.description)
        missing: List[str] = []
        if len(normalized) < 12:
            missing.append("description")
        if not job.location_text or job.latitude is None or job.longitude is None:
            missing.append("location")
        if not job.start_at:
            missing.append("schedule")

        urgency = "NORMAL"
        if _contains(normalized, CRITICAL_TERMS):
            urgency = "CRITICAL"
        elif _contains(normalized, HIGH_TERMS):
            urgency = "HIGH"

        category_id, required_skills, confidence, keyword_hits = self._category(job)
        evidence = self.index.search(job.description, limit=5)
        evidence_ids = tuple(row[0] for row in evidence)
        reason_codes = ["RULE_BASELINE"]
        if keyword_hits:
            reason_codes.append("CATEGORY_KEYWORD_MATCH")
        if category_id and normalize_text(job.category_hint or "") == normalize_text(category_id):
            reason_codes.append("CATEGORY_HINT_MATCH")
        if urgency in {"HIGH", "CRITICAL"}:
            reason_codes.append("URGENCY_RULE_MATCH")
        if missing:
            reason_codes.append("MISSING_REQUIRED_FIELDS")
        if category_id is None:
            reason_codes.append("UNKNOWN_CATEGORY")

        status = triage_status_for(category_id, confidence, missing)
        if status == "READY_FOR_ASSIGNMENT" and "description" in missing:
            reason_codes.append("LIMITED_DESCRIPTION_NON_BLOCKING")

        return TriageResult(
            job_id=job.job_id,
            triage_status=status,
            category_id=category_id,
            urgency=urgency,
            required_skills=required_skills,
            missing_fields=tuple(sorted(set(missing))),
            confidence=round(confidence, 4),
            evidence_doc_ids=evidence_ids,
            reason_codes=tuple(reason_codes),
            issue_summary=" ".join(job.description.split())[:300],
            extracted_issues=keyword_hits,
            language=job.language_hint or detect_language(job.description),
            safety_flags=("POTENTIAL_IMMEDIATE_HAZARD",) if urgency == "CRITICAL" else tuple(),
            original_category=(
                category_id
                if normalize_text(job.category_hint or "") == normalize_text(category_id or "")
                else None
            ),
            final_category=category_id,
        )
