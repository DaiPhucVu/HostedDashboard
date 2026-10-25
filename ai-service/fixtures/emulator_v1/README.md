# Firebase Emulator Dataset V1

This dataset is isolated test data. It contains no real people and must not be
imported into the shared Firebase project.

- 102 labelled requests: 40 English, 40 Bangla, and 22 mixed/Banglish.
- 34 complete eligible providers: two for each service family.
- Three negative providers for verification, availability, and distance cases.
- Completed jobs and customer reviews used to derive provider history.
- Six test customers and one emulator-only administrator.

Each label records its source type and remains marked
`REQUIRES_TWO_REVIEWERS`. It can exercise the system now, but it cannot be used
as final evaluation evidence until two team members approve the expected
category, urgency, missing fields, and relevant providers.

Regenerate the files with:

```bash
cd ai-service
python3 scripts/generate_emulator_dataset.py
```

Seed running Firebase Database and Auth emulators with:

```bash
python3 scripts/seed_firebase_emulator.py
```
