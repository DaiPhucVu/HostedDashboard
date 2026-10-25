# Local AI Setup

## Prerequisites

Install Python 3.9+, Node.js, and [Ollama](https://ollama.com/download).

The default model is [`qwen3:8b`](https://ollama.com/library/qwen3%3A8b). The
first download is about 5.2 GB.

For a lower-memory computer, select a smaller model before starting:

```bash
HANDYMAN_OLLAMA_MODEL=qwen3:4b ./scripts/start-local.sh
```

On Windows:

```bat
set HANDYMAN_OLLAMA_MODEL=qwen3:4b
scripts\start-local.bat
```

## One-command start

From the repository root:

```bat
scripts\start-local.bat
```

or on macOS/Linux:

```bash
./scripts/start-local.sh
```

The script checks the required commands, starts Ollama when needed, downloads
the model, installs Dashboard dependencies on the first run, and opens both
local services.

## Manual start

Terminal 1:

```bash
ollama serve
```

Terminal 2:

```bash
ollama pull qwen3:8b
cd ai-service
HANDYMAN_AI_PROVIDER=ollama \
HANDYMAN_OLLAMA_MODEL=qwen3:8b \
HANDYMAN_CORS_ORIGIN=http://127.0.0.1:3000,http://localhost:3000 \
python3 -m app.api.server --port 8080
```

Terminal 3:

```bash
cd handyman-admin-dashboard
npm ci
REACT_APP_LOCAL_AI_SERVICE_URL=http://127.0.0.1:8080 npm start
```

Open `http://127.0.0.1:3000/job-management`.

## Quick checks

```bash
curl http://127.0.0.1:11434/api/tags
curl http://127.0.0.1:8080/health
```

If the Dashboard cannot load recommendations, confirm that the AI API is on
port 8080 and restart the Dashboard after changing its environment variables.

## Isolated evaluation dataset

Use the Firebase Emulator dataset when testing ranking or automatic assignment.
It does not read or write the shared Firebase database.

Windows:

```bat
scripts\start-test-environment.bat
```

macOS/Linux:

```bash
./scripts/start-test-environment.sh
```

The first run downloads Firebase Tools through `npx`. Open
`http://127.0.0.1:3000/job-management` and sign in with
`admin@example.com / admin123`. Firebase Emulator UI is available at
`http://127.0.0.1:4000`.

The evaluation environment starts in **Manual** assignment mode. Turn on
**Automatic AI assignment** in Job Management before creating a new test job.
Only jobs created after the switch is enabled are considered; existing jobs
are never bulk-assigned. The startup script also runs the Firebase assignment
worker, so automatic assignment continues even when the Job Management page is
closed.
