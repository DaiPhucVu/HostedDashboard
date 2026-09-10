# Architecture Decisions

## ADR-001: Local-first repository ports

Production Firebase access is unavailable. Domain services depend on repository
interfaces. Fixture and SQLite implementations are used for evaluation;
PostgreSQL is the deployed persistence target. An authorized team member can add
a Firebase/API synchronisation adapter later without changing triage or ranking
logic.

## ADR-002: FTS5/BM25 is the lexical baseline

SQLite FTS5 is available in the local Python runtime and includes BM25 ranking. It
is small, deterministic, and already performed well in the Ops benchmark. It is a
baseline, not a permanent commitment.

## ADR-003: Hybrid retrieval is earned by evaluation

Multilingual dense retrieval plus reciprocal-rank fusion is the next experiment.
It ships only if it improves held-out Bangla/English/Banglish retrieval without an
unacceptable latency regression.

## ADR-004: Structured ranking before learned-to-rank

The MVP uses hard filters plus a weighted score. LightGBM/LambdaMART is deferred
until the project has sufficient admin decisions and task outcomes to create
credible labels.

## ADR-005: Human approval before automatic assignment

The Dashboard owns administrator review. Automatic assignment is deferred until
classification, urgency, completeness, provider-fit, fairness, and outcome
metrics meet agreed thresholds.

## ADR-006: One canonical Job node

New work targets `Job`, not legacy `DummyJob`. Quote/negotiation fields are not part
of the new contract and remain read-only compatibility data until migration ends.

## ADR-007: PostgreSQL owns concurrent workflow state

SQLite does not store deployed jobs or assignments. PostgreSQL owns workflow
state, idempotency, optimistic versions, row locks, provider capacity updates, and
assignment audit events. The Dashboard must eventually assign through the service
API instead of performing multiple direct client-side writes.

## ADR-008: Qwen interprets; deterministic code governs

FTS5 retrieves full internal knowledge and Qwen produces structured semantic
triage through local Ollama. A rule guard owns the closed taxonomy, canonical
required skills, missing structured fields, evidence-grounding threshold, and
urgency floor. Provider failure automatically returns the rule baseline.
Provider verification, availability, capacity, skills, radius, assignment state,
and weighted ranking remain deterministic code and are never delegated to the
LLM.

## ADR-009: Ollama is the MVP model runtime

The shared development branch supports local Ollama only. Cloud deployment is
deferred until its API contract, credentials, limits, and regression tests are
ready. Runtime inference failures use the deterministic rules fallback.

## ADR-010: Existing Firebase is the first integration bridge

For the first three-client demonstration, Android continues to create and read
the existing `Job` records and the Dashboard continues to write assignment state
to the same records. The AI service remains responsible only for semantic
triage, hard provider filtering, and ranking. This avoids a second Job store and
sync logic while Firebase server credentials are unavailable. Moving concurrent
assignment state behind the PostgreSQL service remains the production target.

## ADR-011: Distance fallback is informational, not eligible

When strict ranking has no candidates, the service may return a separate list of
providers who still pass verification, required skills, availability, and capacity
but fail or lack the distance check. These alternatives are visibly labelled and
cannot be assigned from the recommendation. This helps administrators understand
provider coverage without weakening the assignment rules.

## ADR-012: Category families determine provider relevance

A provider is eligible when any recorded trade or specialty belongs to the
triaged App service family. An exact specialty mentioned by the customer improves
the skill score, but its absence does not remove a related provider. Verification,
availability, capacity, and service radius remain hard assignment constraints.
This prevents broad requests such as Beauty and Wellness or Appliance Repair from
returning no candidates when a relevant specialist exists.

## ADR-013: The App category anchors semantic triage

When the customer selected a supported App category, that category remains the
service family used for provider matching. Qwen extracts intent details, urgency,
missing information and specialties, but cannot replace the selected family.
Jobs without a valid category continue to rely on grounded semantic or rule
classification.
