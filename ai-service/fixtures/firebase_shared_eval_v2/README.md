# Shared Firebase evaluation dataset

This fixture provides repeatable provider coverage for assignment testing without changing real provider records.

## Contents

- 100 synthetic provider profiles across all 17 mobile service families
- At least four eligible providers in each family
- Traceable completed, cancelled, and active job history
- Customer reviews linked to completed jobs
- 34 broad and specific ranking cases
- Verified, unavailable, pending, at-capacity, and distance boundary profiles

All records use `datasetVersion: firebase-shared-eval-v2-100`, `sourceType: SYNTHETIC_TEST_DATA`, and IDs beginning with `eval-v2-`.

Historical jobs are stored under `EvaluationJobHistory`, with provider-side references under `evaluationJobs`. They are used by ranking and the Dashboard provider profile but do not appear in the operational job list or the Android customer job list. Operational `allJobs` indexes remain reserved for real assignments.

The provider records are Firebase Database profiles, not Firebase Authentication accounts. No real contact details or identity documents are included.

## Generate and validate

Run from `ai-service`:

```bash
python3 scripts/generate_shared_evaluation_dataset.py
python3 -m unittest tests/test_shared_evaluation_dataset.py -v
```

## Shared Firebase seed

Set the existing Firebase configuration variables, then run a dry-run:

```bash
python3 scripts/seed_shared_firebase_evaluation.py
```

Apply the versioned records:

```bash
python3 scripts/seed_shared_firebase_evaluation.py --apply
```

The seed checks every target ID and refuses to overwrite a record that is not tagged with this dataset version. Re-running the command skips existing dataset records so live job indexes are preserved.

To preview removal:

```bash
python3 scripts/seed_shared_firebase_evaluation.py --remove
```

Add `--apply` only when the shared test dataset should be removed.
