import unittest
from pathlib import Path

from app.repositories.fixtures import FixtureRepository
from app.retrieval.fts5 import Fts5KnowledgeIndex, query_tokens


ROOT = Path(__file__).resolve().parents[1]


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        fixtures = FixtureRepository(ROOT / "fixtures")
        self.index = Fts5KnowledgeIndex(fixtures.list_documents())

    def test_english_plumbing_retrieval(self):
        ids = [row[0] for row in self.index.search("kitchen pipe water leak")]
        self.assertIn("policy-plumbing", ids)

    def test_bangla_electrical_retrieval(self):
        ids = [row[0] for row in self.index.search("সকেট এবং তার ঠিক করতে হবে")]
        self.assertIn("policy-electrical", ids)

    def test_bangla_combining_marks_are_preserved(self):
        self.assertIn("পানি", query_tokens("পানি লিক"))

    def test_rag_retrieval_returns_full_grounding_text(self):
        evidence = self.index.retrieve("burning smell from wall outlet", limit=5)
        self.assertTrue(evidence)
        self.assertIn("electrical", {item.category_id for item in evidence})
        self.assertTrue(all(item.title and item.body for item in evidence))
        self.assertIn("burning smell", " ".join(item.body.lower() for item in evidence))
