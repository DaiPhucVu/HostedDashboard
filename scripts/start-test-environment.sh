#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_NAME="${HANDYMAN_OLLAMA_MODEL:-qwen3:8b}"
EMULATOR_PROJECT_ID="demo-handyman"
DATABASE_NAMESPACE="handymanapplicationcos40006"
NPM_CACHE="${TMPDIR:-/tmp}/handyman-npm-cache"
FIREBASE_EMULATORS_PATH="${TMPDIR:-/tmp}/handyman-firebase-emulators"

for command_name in npx ollama python3 npm curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name"
    exit 1
  fi
done

if ! curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null; then
  ollama serve >/tmp/handyman-test-ollama.log 2>&1 &
fi
ollama pull "$MODEL_NAME"

if [ ! -d "$PROJECT_ROOT/handyman-admin-dashboard/node_modules" ]; then
  (cd "$PROJECT_ROOT/handyman-admin-dashboard" && npm ci)
fi

(
  cd "$PROJECT_ROOT/handyman-admin-dashboard"
  npm_config_cache="$NPM_CACHE" \
  FIREBASE_EMULATORS_PATH="$FIREBASE_EMULATORS_PATH" \
  FIREBASE_TOOLS_DISABLE_UPDATE_CHECK=1 \
  CI=1 \
  npx --yes firebase-tools emulators:start \
    --config firebase.emulator.json \
    --project "$EMULATOR_PROJECT_ID"
) >/tmp/handyman-firebase-emulator.log 2>&1 &
EMULATOR_PID=$!

for _ in {1..30}; do
  curl --silent --fail "http://127.0.0.1:9000/.settings/rules.json?ns=$DATABASE_NAMESPACE" >/dev/null && break
  sleep 1
done

if ! curl --silent --fail "http://127.0.0.1:9000/.settings/rules.json?ns=$DATABASE_NAMESPACE" >/dev/null; then
  echo "Firebase emulators did not start. Check /tmp/handyman-firebase-emulator.log."
  exit 1
fi

python3 "$PROJECT_ROOT/ai-service/scripts/seed_firebase_emulator.py"

(
  cd "$PROJECT_ROOT/ai-service"
  HANDYMAN_AI_PROVIDER=ollama \
  HANDYMAN_OLLAMA_MODEL="$MODEL_NAME" \
  HANDYMAN_CORS_ORIGIN=http://127.0.0.1:3000 \
  python3 -m app.api.server --port 8080
) &
AI_PID=$!

(
  cd "$PROJECT_ROOT/ai-service"
  HANDYMAN_AI_PROVIDER=ollama \
  HANDYMAN_OLLAMA_MODEL="$MODEL_NAME" \
  HANDYMAN_FIREBASE_DATABASE_URL=http://127.0.0.1:9000 \
  HANDYMAN_FIREBASE_DATABASE_NAMESPACE="$DATABASE_NAMESPACE" \
  HANDYMAN_FIREBASE_AUTH_TOKEN=owner \
  python3 -m app.workers.firebase_auto_assignment
) &
WORKER_PID=$!

(
  cd "$PROJECT_ROOT/handyman-admin-dashboard"
  REACT_APP_USE_LOCAL_FIXTURES=false \
  REACT_APP_LOCAL_AI_SERVICE_URL=http://127.0.0.1:8080 \
  REACT_APP_FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 \
  REACT_APP_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 \
  npm start
) &
DASHBOARD_PID=$!

echo "Firebase UI: http://127.0.0.1:4000"
echo "Dashboard:   http://127.0.0.1:3000/job-management"
echo "Login:       admin@example.com / admin123"

cleanup() {
  kill "$AI_PID" "$WORKER_PID" "$DASHBOARD_PID" "$EMULATOR_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait
