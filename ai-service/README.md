# Handyman AI Service

Local Python service for task triage, provider ranking, and threshold-gated
automatic assignment.

## Flow

1. Normalize the job submitted through Firebase.
2. Retrieve up to five relevant service rules and examples with FTS5/BM25.
3. Ask local Qwen for schema-validated triage data.
4. Apply deterministic taxonomy, completeness, and urgency guards.
5. Filter providers by verification, availability, capacity, service family, and radius.
6. Return up to five ranked candidates with a score breakdown.
7. In automatic mode, assign rank one only when every readiness gate passes;
   otherwise leave the job for manual review.

If Ollama is unavailable or returns invalid output, triage falls back to rules.
Provider constraints are never delegated to the model.

The Firebase worker runs separately from the Dashboard, so automatic assignment
does not depend on an administrator keeping the page open. Use the isolated test
environment in `docs/LOCAL_SETUP.md` to run the Dashboard, emulators, AI API, and
worker together.

## Run

```bash
ollama pull qwen3:8b
HANDYMAN_AI_PROVIDER=ollama \
HANDYMAN_OLLAMA_MODEL=qwen3:8b \
HANDYMAN_CORS_ORIGIN=http://127.0.0.1:3000,http://localhost:3000 \
python3 -m app.api.server --port 8080
```

See [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md) for complete setup.

## Test

```bash
python3 -m unittest discover -s tests -v
python3 -m app.evals.run_baseline
```

PostgreSQL preparation is documented in
[`docs/POSTGRESQL_MIGRATION.md`](docs/POSTGRESQL_MIGRATION.md). SQLite is used
for the local FTS5 knowledge index, not shared workflow state.
