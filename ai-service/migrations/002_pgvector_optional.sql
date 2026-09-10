-- Apply only after the pgvector extension is installed on the target PostgreSQL host.
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_documents
    ADD COLUMN embedding vector(1024),
    ADD COLUMN embedding_model text;

CREATE INDEX knowledge_documents_embedding_hnsw_idx
    ON knowledge_documents USING hnsw (embedding vector_cosine_ops);

COMMIT;
