from pathlib import Path
from typing import Any, Dict, Optional

from app.domain.contracts import load_schema, validate
from app.domain.models import JobInput, ProviderProfile
from app.ranking.weighted import WeightedProviderRanker
from app.repositories.fixtures import FixtureRepository
from app.retrieval.fts5 import Fts5KnowledgeIndex
from app.triage.rules import RuleTriageService, load_taxonomy
from app.triage.semantic import (
    SemanticRagTriageService,
    SemanticTriageClient,
    create_semantic_triage_client,
)


ROOT = Path(__file__).resolve().parents[2]


class AssignmentReviewService:
    """Contract-valid local composition used by HTTP and integration tests."""

    def __init__(
        self,
        root: Optional[Path] = None,
        semantic_client: Optional[SemanticTriageClient] = None,
    ):
        self.root = root or ROOT
        repository = FixtureRepository(self.root / "fixtures")
        providers_file = self.root / "fixtures" / "providers_dashboard.json"
        self.providers = repository.list_providers_from(providers_file)
        index = Fts5KnowledgeIndex(repository.list_documents())
        taxonomy = load_taxonomy(self.root / "taxonomy" / "service_taxonomy.json")
        rule_service = RuleTriageService(taxonomy, index)
        client = semantic_client or create_semantic_triage_client()
        self.semantic_provider = getattr(client, "provider", "custom")
        self.semantic_model = client.model
        self.triage_service = SemanticRagTriageService(
            taxonomy,
            index,
            client,
            rule_service,
        )
        self.ranker = WeightedProviderRanker()
        self.schemas = {
            "job": load_schema(self.root / "contracts" / "job.schema.json"),
            "provider": load_schema(self.root / "contracts" / "provider.schema.json"),
            "triage": load_schema(self.root / "contracts" / "triage-result.schema.json"),
            "ranking": load_schema(self.root / "contracts" / "ranking-result.schema.json"),
        }

    def review(
        self,
        payload: Dict[str, Any],
        provider_payloads: Optional[list[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        validate(payload, self.schemas["job"])
        job = JobInput.from_dict(payload)
        providers = self.providers
        if provider_payloads is not None:
            providers = []
            for provider_payload in provider_payloads:
                validate(provider_payload, self.schemas["provider"])
                providers.append(ProviderProfile.from_dict(provider_payload))
        triage = self.triage_service.triage(job)
        ranking = self.ranker.rank(job, triage, providers)
        triage_payload = triage.to_contract_dict()
        ranking_payload = ranking.to_contract_dict()
        validate(triage_payload, self.schemas["triage"])
        validate(ranking_payload, self.schemas["ranking"])
        return {
            "source": "LOCAL_SERVICE",
            "triage": triage_payload,
            "ranking": ranking_payload,
        }
