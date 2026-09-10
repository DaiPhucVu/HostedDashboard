# PostgreSQL target and concurrency contract

SQLite FTS5 remains an in-memory lexical baseline for unit tests and offline
evaluation. It is not the deployed system of record. Development, staging, and
production use PostgreSQL; semantic retrieval additionally uses pgvector when the
evaluation gate justifies it.

## Migration order

1. Apply `migrations/001_postgres_core.sql`.
2. Load taxonomy/knowledge documents and fixture data in a development database.
3. Apply `migrations/002_pgvector_optional.sql` only where pgvector is available.
4. Configure the implemented PostgreSQL repository adapter with
   `HANDYMAN_DATABASE_URL` and the optional `postgres` package dependency.
5. Add the authorized Firebase/API synchronisation adapter later. Firebase fields
   remain external transport fields and do not define the domain model.

## Atomic assignment transaction

The repository implementation must perform the following in one transaction:

1. Return the existing assignment when `idempotency_key` already exists.
2. Lock the job row with `SELECT ... FOR UPDATE`.
3. Verify `workflow_status IN ('READY_FOR_ASSIGNMENT', 'CANDIDATES_READY')` and
   `version = expected_job_version`.
4. Lock and re-check the provider: verified, available, skilled, within capacity,
   and within service radius.
5. Insert the assignment and its audit event.
6. Increment `providers.active_jobs` and both entity versions.
7. Change the job to `OFFERED` and commit.

The partial unique index `one_active_assignment_per_job` is the final database
guard against two active assignments. A stale version, invalid state, or unique
constraint violation is returned as a conflict; callers may refresh but must not
silently overwrite it.

Queue workers should claim batches with `FOR UPDATE SKIP LOCKED`. Interactive
administrator assignment should use a normal row lock so the UI receives a clear
conflict if another actor assigned the job first.

## Required concurrency tests

- 50 simultaneous commands for one job produce exactly one active assignment.
- Repeating one idempotency key returns the same assignment.
- Provider capacity never exceeds `max_concurrent_jobs`.
- An administrator and AI worker racing on the same job cannot overwrite each other.
- Failed transactions leave no assignment event or workload increment behind.
- Concurrent retrieval remains available while knowledge documents are updated.

## Current verification boundary

The adapter and transaction order are unit tested through the DB-API boundary.
Local concurrency tests run 50 assignment commands against one job and permit
exactly one success. A real PostgreSQL integration test is still mandatory before
deployment because the current development machine has no PostgreSQL server,
Docker runtime, or psycopg driver installed.
