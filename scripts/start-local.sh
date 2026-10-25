#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_NAME="${HANDYMAN_OLLAMA_MODEL:-qwen3:8b}"

for command_name in ollama python3 npm curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name"
    echo "Setup guide: $PROJECT_ROOT/ai-service/docs/LOCAL_SETUP.md"
    exit 1
  fi
done

if ! curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "Starting Ollama..."
  ollama serve >/tmp/handyman-ollama.log 2>&1 &
  for _ in {1..15}; do
    curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null && break
    sleep 1
  done
fi

if ! curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "Ollama did not start. Check /tmp/handyman-ollama.log."
  exit 1
fi

ollama pull "$MODEL_NAME"

if [ ! -d "$PROJECT_ROOT/handyman-admin-dashboard/node_modules" ]; then
  (cd "$PROJECT_ROOT/handyman-admin-dashboard" && npm ci)
fi

echo "AI API:    http://127.0.0.1:8080"
echo "Dashboard: http://127.0.0.1:3000/job-management"

(
  cd "$PROJECT_ROOT/ai-service"
  HANDYMAN_AI_PROVIDER=ollama \
  HANDYMAN_OLLAMA_MODEL="$MODEL_NAME" \
  HANDYMAN_CORS_ORIGIN=http://127.0.0.1:3000 \
  python3 -m app.api.server --port 8080
) &
AI_PID=$!

(
  cd "$PROJECT_ROOT/handyman-admin-dashboard"
  REACT_APP_USE_LOCAL_FIXTURES=false \
  REACT_APP_LOCAL_AI_SERVICE_URL=http://127.0.0.1:8080 \
  npm start
) &
DASHBOARD_PID=$!

cleanup() {
  kill "$AI_PID" "$DASHBOARD_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait
