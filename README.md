# HostedDashboard

Administrator Dashboard with local AI triage and provider recommendations.

## Local setup

Required software:

- Python 3.9 or newer
- Node.js and npm
- [Ollama](https://ollama.com/download)

Windows:

```bat
scripts\start-local.bat
```

macOS or Linux:

```bash
./scripts/start-local.sh
```

The first run downloads `qwen3:8b`, installs Dashboard packages when needed,
and starts both local services:

- AI API: `http://127.0.0.1:8080`
- Dashboard: `http://127.0.0.1:3000/job-management`

The Dashboard reads the existing Firebase `Job` and provider records. Team
members still need access permitted by the Firebase project rules.

Manual setup and troubleshooting are in
[`ai-service/docs/LOCAL_SETUP.md`](ai-service/docs/LOCAL_SETUP.md).

## Components

- `handyman-admin-dashboard/`: React administrator interface
- `ai-service/`: FTS5 retrieval, Qwen triage, deterministic validation, provider
  filtering, and weighted ranking

The LLM interprets the request. Verification, availability, workload, service-family fit,
distance, and assignment remain deterministic business rules.

## Verification

```bash
cd ai-service
python3 -m unittest discover -s tests -v
python3 -m app.evals.run_baseline

cd ../handyman-admin-dashboard
npm test -- --watchAll=false
npm run build
```
