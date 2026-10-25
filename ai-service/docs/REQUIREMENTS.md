# Requirements and Acceptance Gates

## Functional requirements

- Classify English, Bangla, and mixed Banglish service requests into a closed
  taxonomy.
- Detect HIGH and CRITICAL requests and place them first in the admin queue.
- Detect missing description, location, and schedule information.
- Recommend only verified, available, nearby providers with capacity and a trade
  or specialty in the requested service family.
- Treat an explicitly requested specialty as a ranking signal, not a hard
  requirement that removes otherwise relevant providers.
- When no nearby provider is eligible, optionally show a separate, non-assignable
  distance-relaxed alternative list; verification, skills, availability, and
  capacity remain mandatory.
- Return a top-five list with score breakdown and reason codes.
- Require administrator approval and record any override reason.
- Allow an administrator to cancel an offered assignment, release provider
  capacity, and return the job to the assignable workflow.

## Milestone gates

### Seed baseline

- Contract validation passes for every fixture.
- Hard-filter violations: zero.
- Identical input produces identical output.
- Baseline metrics and failures are written to `artifacts/baseline.json`.

### Dataset readiness

- At least 100 labelled jobs: 40 English, 40 Bangla, 20 mixed/Banglish.
- Typical, edge, urgent, incomplete, and adversarial cases are represented.
- At least 30 provider profiles cover new, experienced, unavailable, distant,
  unverified, and overloaded providers.

### Retrieval candidate

- FTS5 baseline Recall@5 >= 0.80.
- Hybrid must improve Recall@5 by at least 0.05 absolute, or provide a documented
  Bangla/Banglish benefit with no more than 0.02 overall regression.
- Cached retrieval p95 <= 300 ms on the agreed development machine.

### Triage candidate

- Category macro-F1 >= 0.80.
- Urgency detection recall >= 0.95, measured separately for HIGH and CRITICAL.
- Missing-field F1 >= 0.80.
- Structured-output validation and fallback rate = 100%.
- Invalid/out-of-taxonomy LLM categories accepted by the guard = zero.
- Rule-defined HIGH/CRITICAL urgency downgrades accepted from the LLM = zero.
- Every semantic result records retrieved evidence IDs and model version.
- Ollama unavailable/timeout/invalid JSON must return a
  contract-valid rule fallback without preventing provider matching.

### Ranking candidate

- Hard-filter violations = 0.
- Provider-fit Recall@5 >= 0.80 on human-labelled relevant providers.
- NDCG@5 >= 0.75 after human labels exist.
- Every score can be recomputed from stored features and ranking version.

## Non-requirements for MVP

- No HyDE hot path.
- No multi-agent triage.
- No learned-to-rank before outcome labels exist.
- No model or Firebase secrets in mobile or browser clients.
- No automated test-provider creation in the shared Firebase database.
