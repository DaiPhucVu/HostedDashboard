import json
import unittest
from pathlib import Path

from app.domain.contracts import ContractError, load_schema, validate


ROOT = Path(__file__).resolve().parents[1]


class ContractTests(unittest.TestCase):
    def test_seed_fixtures_validate(self):
        job_schema = load_schema(ROOT / "contracts/job.schema.json")
        provider_schema = load_schema(ROOT / "contracts/provider.schema.json")
        jobs = json.loads((ROOT / "fixtures/jobs.json").read_text(encoding="utf-8"))
        providers = json.loads((ROOT / "fixtures/providers.json").read_text(encoding="utf-8"))
        for case in jobs:
            validate(case["input"], job_schema)
        for provider in providers:
            validate(provider, provider_schema)

    def test_contract_rejects_unknown_job_field(self):
        schema = load_schema(ROOT / "contracts/job.schema.json")
        with self.assertRaises(ContractError):
            validate({"jobId": "job-1", "description": "valid description", "unknown": True}, schema)
