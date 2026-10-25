import sqlite3
from dataclasses import dataclass
from threading import Lock
import unicodedata
from typing import Iterable, List, Sequence, Tuple

from app.domain.models import KnowledgeDocument


@dataclass(frozen=True)
class RetrievedEvidence:
    doc_id: str
    category_id: str
    title: str
    body: str
    keywords: str
    score: float

    def to_prompt_dict(self):
        return {
            "docId": self.doc_id,
            "categoryId": self.category_id,
            "title": self.title,
            "body": self.body,
            "keywords": self.keywords,
        }


def normalize_text(text: str) -> str:
    return unicodedata.normalize("NFC", text).casefold().strip()


def query_tokens(text: str) -> List[str]:
    normalized = normalize_text(text)
    pieces: List[str] = []
    current: List[str] = []
    for char in normalized:
        category = unicodedata.category(char)
        if category[0] in {"L", "M", "N"}:
            current.append(char)
        elif current:
            pieces.append("".join(current))
            current = []
    if current:
        pieces.append("".join(current))
    return [piece for piece in pieces if piece]


class Fts5KnowledgeIndex:
    def __init__(self, documents: Iterable[KnowledgeDocument]):
        # This index is an offline/local baseline. The lock makes the single
        # in-memory connection safe for the threaded demo HTTP server; deployed
        # retrieval uses PostgreSQL rather than sharing this SQLite connection.
        self._lock = Lock()
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.execute(
            """
            CREATE VIRTUAL TABLE knowledge USING fts5(
                doc_id UNINDEXED,
                category_id UNINDEXED,
                title,
                body,
                keywords,
                tokenize="unicode61 categories 'L* N* Co Mn'"
            )
            """
        )
        self.connection.executemany(
            "INSERT INTO knowledge(doc_id, category_id, title, body, keywords) VALUES (?, ?, ?, ?, ?)",
            [
                (doc.doc_id, doc.category_id, doc.title, doc.body, doc.keywords)
                for doc in documents
            ],
        )

    def retrieve(self, query: str, limit: int = 5) -> List[RetrievedEvidence]:
        tokens = query_tokens(query)
        if not tokens:
            return []
        match_query = " OR ".join('"{}"'.format(token.replace('"', '""')) for token in tokens)
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT doc_id, category_id, title, body, keywords,
                       bm25(knowledge, 0.0, 0.0, 3.0, 1.0, 2.0) AS score
                FROM knowledge
                WHERE knowledge MATCH ?
                ORDER BY score
                LIMIT ?
                """,
                (match_query, limit),
            ).fetchall()
        return [
            RetrievedEvidence(
                doc_id=str(doc_id),
                category_id=str(category_id),
                title=str(title),
                body=str(body),
                keywords=str(keywords),
                score=float(score),
            )
            for doc_id, category_id, title, body, keywords, score in rows
        ]

    def search(self, query: str, limit: int = 5) -> List[Tuple[str, str, float]]:
        """Backward-compatible compact result for rule baselines and callers."""
        return [
            (item.doc_id, item.category_id, item.score)
            for item in self.retrieve(query, limit=limit)
        ]
