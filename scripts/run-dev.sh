#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend/mujoco-ui"
BACKEND_DIR="$ROOT_DIR/backend"

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"

PIDS=()
NAMES=()
CLEANED_UP=0

log() {
  printf '[dev] %s\n' "$*"
}

fail() {
  printf '[dev] ERROR: %s\n' "$*" >&2
  exit 1
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

python_has_backend_deps() {
  "$1" -c "import fastapi, uvicorn, json_repair" >/dev/null 2>&1
}

is_ollama_running() {
  python - "$OLLAMA_BASE_URL" <<'PY' >/dev/null 2>&1
import sys
import urllib.request

url = sys.argv[1].rstrip("/") + "/api/tags"
try:
    urllib.request.urlopen(url, timeout=1).read()
except Exception:
    raise SystemExit(1)
PY
}

start_service() {
  local name="$1"
  shift

  log "Starting $name..."
  "$@" &
  local pid=$!

  PIDS+=("$pid")
  NAMES+=("$name")
  log "$name started with PID $pid"
}

cleanup() {
  local code=$?

  trap - INT TERM EXIT
  if [[ "$CLEANED_UP" -eq 1 ]]; then
    exit "$code"
  fi
  CLEANED_UP=1

  log "Stopping services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  for pid in "${PIDS[@]:-}"; do
    wait "$pid" >/dev/null 2>&1 || true
  done

  exit "$code"
}

trap cleanup INT TERM EXIT

have_command python || fail "python is required."
have_command npm || fail "npm is required."

if [[ ! -d "$FRONTEND_DIR" ]]; then
  fail "Frontend directory not found: $FRONTEND_DIR"
fi

if [[ ! -d "$BACKEND_DIR" ]]; then
  fail "Backend directory not found: $BACKEND_DIR"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  fail "Frontend dependencies are missing. Run: cd frontend/mujoco-ui && npm install"
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if is_ollama_running; then
  log "Ollama is already running at $OLLAMA_BASE_URL"
else
  have_command ollama || fail "Ollama is not running and the 'ollama' command was not found."
  start_service "ollama" ollama serve
fi

if [[ -x "$ROOT_DIR/venv/bin/python" ]] && python_has_backend_deps "$ROOT_DIR/venv/bin/python"; then
  PYTHON_BIN="$ROOT_DIR/venv/bin/python"
elif python_has_backend_deps "$(command -v python)"; then
  PYTHON_BIN="$(command -v python)"
  if [[ -x "$ROOT_DIR/venv/bin/python" ]]; then
    log "Repo venv exists but is missing backend dependencies; using $PYTHON_BIN"
  fi
else
  fail "Backend dependencies are missing. Run: python -m pip install -r requirements.txt"
fi

start_service \
  "backend" \
  bash -c "cd '$BACKEND_DIR' && '$PYTHON_BIN' -m uvicorn main:app --reload --host '$BACKEND_HOST' --port '$BACKEND_PORT'"

start_service \
  "frontend" \
  bash -c "cd '$FRONTEND_DIR' && npm run dev -- --host '$FRONTEND_HOST' --port '$FRONTEND_PORT'"

log "All services launched."
log "Frontend: http://localhost:$FRONTEND_PORT"
log "Backend:  http://localhost:$BACKEND_PORT"
log "Ollama:   $OLLAMA_BASE_URL"
log "Press Ctrl+C to stop services started by this script."

while true; do
  for i in "${!PIDS[@]}"; do
    pid="${PIDS[$i]}"
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      wait "$pid" || true
      fail "${NAMES[$i]} stopped unexpectedly."
    fi
  done
  sleep 1
done
