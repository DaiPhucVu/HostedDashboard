# Architecture

## Current MVP boundary

```text
Handyman Android <----> Firebase <----> HostedDashboard ---- HTTP ----> AI service
                                                                  |
                                                   +--------------+--------------+
                                                   |              |              |
                                                triage         retrieval       ranking
```

Android creates and reads the existing Firebase records. The Dashboard reads the
same jobs and providers, sends a normalized snapshot to the AI service, and writes
the administrator's assignment decision back to Firebase. Android does not call
the AI service directly in the MVP.

The AI service owns model access and ranking policy. SQLite FTS5 contains only the
small local knowledge index; it does not store shared jobs or assignments.

## Triage flow

1. Preserve original user text and normalize Unicode for matching.
2. Retrieve the top five full taxonomy/policy/example documents with FTS5/BM25.
   If retrieval is empty, the semantic layer may still detect unclear or missing
   information, but an ungrounded category cannot become assignable.
3. Send the job and retrieved evidence to Qwen through local Ollama using a
   strict JSON schema.
4. Apply deterministic guards: the App-selected service family, closed taxonomy,
   canonical required skills, structured-field completeness, evidence grounding,
   and urgency floors.
5. Fall back to the rule baseline if the configured model is unavailable, slow,
   or invalid.
6. Produce a contract-valid `TriageResult` with issue summary, extracted issues,
   language, safety flags, evidence IDs, reason codes, and model version.
7. Route incomplete or low-confidence tasks to human review. HIGH/CRITICAL
   urgency changes queue priority but does not block provider recommendation.

The LLM interprets language; it never executes provider or workflow constraints.
The model runtime stays in the Python service and is never exposed to Android or
the browser.

## Provider matching flow

1. Normalize current and legacy provider trade fields into the same service
   families used by the App taxonomy.
2. Reject providers that fail verification, service-family relevance,
   availability, capacity, or distance constraints.
3. Score only eligible providers using normalized structured features. A broad
   family match is sufficient; an explicitly requested specialty is a ranking
   boost rather than an eligibility requirement.
4. Return a deterministic top-k result with feature breakdown and reason codes.
5. If the eligible list is empty, return distance-relaxed providers in a separate
   non-assignable `alternatives` list. Never relax verification, required skills,
   availability, or capacity.
6. Let an administrator approve or override an eligible recommendation.

Provider ranking is not general-purpose RAG. Semantic similarity may later become
one bounded skill-match feature; it may not override hard constraints.

## Target persistence boundary

- SQLite FTS5 is an in-memory, single-process knowledge index only.
- PostgreSQL is the future runtime database for jobs, providers, assignments,
  audit events, and lexical knowledge retrieval.
- pgvector is an optional PostgreSQL extension for the evaluated semantic stage.
- Assignment is a PostgreSQL transaction with row/version checks, an idempotency
  key, and a unique active-assignment constraint.
- In that target architecture, Dashboard and Android call the service API instead
  of writing assignment state directly.

## State flow

```text
DRAFT
  -> TRIAGING
  -> NEEDS_INFO | MANUAL_REVIEW | READY_FOR_ASSIGNMENT
  -> CANDIDATES_READY
  -> OFFERED
  -> ACCEPTED | DECLINED
  -> IN_PROGRESS
  -> COMPLETED | CANCELLED
```
