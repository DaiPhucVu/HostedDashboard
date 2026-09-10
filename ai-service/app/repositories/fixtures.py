import json
from pathlib import Path
from typing import Any, Dict, List

from app.domain.models import JobInput, KnowledgeDocument, ProviderProfile


class FixtureRepository:
    def __init__(self, fixture_dir: Path):
        self.fixture_dir = fixture_dir

    def _load(self, name: str) -> List[Dict[str, Any]]:
        with (self.fixture_dir / name).open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def job_cases(self) -> List[Dict[str, Any]]:
        return self._load("jobs.json")

    def list_jobs(self) -> List[JobInput]:
        return [JobInput.from_dict(case["input"]) for case in self.job_cases()]

    def list_providers(self) -> List[ProviderProfile]:
        return [ProviderProfile.from_dict(item) for item in self._load("providers.json")]

    def list_providers_from(self, path: Path) -> List[ProviderProfile]:
        with path.open("r", encoding="utf-8") as handle:
            return [ProviderProfile.from_dict(item) for item in json.load(handle)]

    def list_documents(self) -> List[KnowledgeDocument]:
        return [KnowledgeDocument.from_dict(item) for item in self._load("knowledge_docs.json")]
