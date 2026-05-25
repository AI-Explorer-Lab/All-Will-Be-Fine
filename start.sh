#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT_DIR}/.run/logs"
PID_DIR="${ROOT_DIR}/.run/pids"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

DB_CONTAINER="${DB_CONTAINER:-all-will-be-fine-postgres}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-review_app}"
DB_USER="${DB_USER:-review_user}"
DB_PASSWORD="${DB_PASSWORD:-review_password}"
DB_TYPE="${DB_TYPE:-postgres}"
DATABASE_URL="${DATABASE_URL:-postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}}"

mkdir -p "${LOG_DIR}" "${PID_DIR}"

info() {
  printf '\033[1;34m[all-will-be-fine]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[all-will-be-fine]\033[0m %s\n' "$*"
}

fail() {
  printf '\033[1;31m[all-will-be-fine]\033[0m %s\n' "$*" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

if [[ -z "${PYTHON_BIN:-}" ]]; then
  if has_cmd python3; then
    PYTHON_BIN="python3"
  elif has_cmd python; then
    PYTHON_BIN="python"
  else
    fail "Python is required but neither python3 nor python was found"
  fi
fi

pid_alive() {
  local pid_file="$1"
  [[ -f "${pid_file}" ]] && kill -0 "$(cat "${pid_file}")" >/dev/null 2>&1
}

port_open() {
  local host="$1"
  local port="$2"
  "${PYTHON_BIN}" - "$host" "$port" <<'PY'
import socket
import sys

host, port = sys.argv[1], int(sys.argv[2])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.settimeout(1)
    sys.exit(0 if sock.connect_ex((host, port)) == 0 else 1)
PY
}

wait_for_port() {
  local name="$1"
  local host="$2"
  local port="$3"
  local attempts="${4:-30}"

  for _ in $(seq 1 "${attempts}"); do
    if port_open "${host}" "${port}"; then
      info "${name} is ready on ${host}:${port}"
      return 0
    fi
    sleep 1
  done

  fail "${name} did not become ready on ${host}:${port}"
}

ensure_python_deps() {
  if [[ "${SKIP_PIP_INSTALL:-0}" == "1" ]]; then
    info "Skipping Python dependency install because SKIP_PIP_INSTALL=1"
    return
  fi

  info "Installing backend Python dependencies"
  "${PYTHON_BIN}" -m pip install -r "${ROOT_DIR}/backend/requirements.txt"
}

start_database() {
  if [[ "${DB_TYPE}" != "postgres" ]]; then
    info "DB_TYPE=${DB_TYPE}; skipping Postgres startup"
    return
  fi

  if port_open "${DB_HOST}" "${DB_PORT}"; then
    info "Postgres already appears to be listening on ${DB_HOST}:${DB_PORT}"
    return
  fi

  if ! has_cmd docker; then
    fail "Postgres is not listening on ${DB_HOST}:${DB_PORT}, and docker is not installed. Start Postgres manually or run with DB_TYPE=memory."
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "${DB_CONTAINER}"; then
    info "Starting existing Postgres container ${DB_CONTAINER}"
    docker start "${DB_CONTAINER}" >/dev/null
  else
    info "Creating Postgres container ${DB_CONTAINER}"
    docker run -d \
      --name "${DB_CONTAINER}" \
      -e POSTGRES_DB="${DB_NAME}" \
      -e POSTGRES_USER="${DB_USER}" \
      -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
      -p "${DB_PORT}:5432" \
      -v "${DB_CONTAINER}-data:/var/lib/postgresql/data" \
      postgres:16-alpine >/dev/null
  fi

  wait_for_port "Postgres" "${DB_HOST}" "${DB_PORT}" 45
}

start_backend() {
  local pid_file="${PID_DIR}/backend.pid"

  if pid_alive "${pid_file}"; then
    info "Backend is already running with PID $(cat "${pid_file}")"
    return
  fi

  if port_open "${BACKEND_HOST}" "${BACKEND_PORT}"; then
    warn "Port ${BACKEND_HOST}:${BACKEND_PORT} is already in use; not starting another backend"
    return
  fi

  info "Starting backend on http://${BACKEND_HOST}:${BACKEND_PORT}"
  (
    cd "${ROOT_DIR}"
    DB_TYPE="${DB_TYPE}" DATABASE_URL="${DATABASE_URL}" \
      "${PYTHON_BIN}" -m uvicorn backend.main:app --reload --host "${BACKEND_HOST}" --port "${BACKEND_PORT}"
  ) >"${LOG_DIR}/backend.log" 2>&1 &
  echo "$!" >"${pid_file}"

  wait_for_port "Backend" "${BACKEND_HOST}" "${BACKEND_PORT}" 30
}

start_frontend() {
  local pid_file="${PID_DIR}/frontend.pid"

  if pid_alive "${pid_file}"; then
    info "Frontend is already running with PID $(cat "${pid_file}")"
    return
  fi

  if port_open "${FRONTEND_HOST}" "${FRONTEND_PORT}"; then
    warn "Port ${FRONTEND_HOST}:${FRONTEND_PORT} is already in use; not starting another frontend"
    return
  fi

  info "Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}"
  (
    cd "${ROOT_DIR}"
    "${PYTHON_BIN}" -m http.server "${FRONTEND_PORT}" --bind "${FRONTEND_HOST}" -d frontend
  ) >"${LOG_DIR}/frontend.log" 2>&1 &
  echo "$!" >"${pid_file}"

  wait_for_port "Frontend" "${FRONTEND_HOST}" "${FRONTEND_PORT}" 15
}

print_summary() {
  cat <<EOF

Started all-will-be-fine.

Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}
Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}
Database: ${DB_TYPE}

Logs:
  ${LOG_DIR}/backend.log
  ${LOG_DIR}/frontend.log

Stop services started by this script:
  ./stop.sh
EOF
}

ensure_python_deps
start_database
start_backend
start_frontend
print_summary
