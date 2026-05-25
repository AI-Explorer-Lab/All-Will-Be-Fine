#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT_DIR}/.run/logs"
PID_DIR="${ROOT_DIR}/.run/pids"
VENV_DIR="${VENV_DIR:-${ROOT_DIR}/.venv}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
if [[ -z "${BACKEND_PORT:-}" ]]; then
  if [[ -f /etc/nginx/sites-enabled/all-will-be-fine ]]; then
    BACKEND_PORT="8002"
  else
    BACKEND_PORT="8000"
  fi
fi
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
if [[ -z "${PUBLIC_FRONTEND_DIR:-}" && -f /etc/nginx/sites-enabled/all-will-be-fine ]]; then
  PUBLIC_FRONTEND_DIR="/var/www/all-will-be-fine"
fi
if [[ -z "${SKIP_FRONTEND_SERVER:-}" && -n "${PUBLIC_FRONTEND_DIR:-}" ]]; then
  SKIP_FRONTEND_SERVER="1"
fi
RESTART_BACKEND="${RESTART_BACKEND:-1}"

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

stop_pid_file() {
  local pid_file="$1"
  if pid_alive "${pid_file}"; then
    local pid
    pid="$(cat "${pid_file}")"
    info "Stopping previous backend PID ${pid}"
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f "${pid_file}"
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

  if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
    info "Creating Python virtual environment at ${VENV_DIR}"
    if ! "${PYTHON_BIN}" -m venv "${VENV_DIR}" >/dev/null 2>&1; then
      warn "python venv is not available for ${PYTHON_BIN}"
      if has_cmd sudo && has_cmd apt-get; then
        info "Installing python3-venv with apt-get"
        sudo apt-get update
        sudo apt-get install -y python3-venv
      elif has_cmd apt-get && [[ "$(id -u)" == "0" ]]; then
        info "Installing python3-venv with apt-get"
        apt-get update
        apt-get install -y python3-venv
      else
        fail "venv is required. Install it with: sudo apt-get update && sudo apt-get install -y python3-venv"
      fi
      "${PYTHON_BIN}" -m venv "${VENV_DIR}"
    fi
  fi

  PYTHON_BIN="${VENV_DIR}/bin/python"

  if ! "${PYTHON_BIN}" -m pip --version >/dev/null 2>&1; then
    warn "pip is not available in ${VENV_DIR}"
    if has_cmd sudo && has_cmd apt-get; then
      info "Installing python3-pip with apt-get"
      sudo apt-get update
      sudo apt-get install -y python3-pip
    elif has_cmd apt-get && [[ "$(id -u)" == "0" ]]; then
      info "Installing python3-pip with apt-get"
      apt-get update
      apt-get install -y python3-pip
    else
      fail "pip is required. Install it with: sudo apt-get update && sudo apt-get install -y python3-pip"
    fi
  fi

  info "Installing backend Python dependencies"
  "${PYTHON_BIN}" -m pip install --upgrade pip
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

  if [[ "${RESTART_BACKEND}" == "1" ]]; then
    stop_pid_file "${pid_file}"
    if has_cmd pgrep; then
      local pids
      pids="$(pgrep -f "uvicorn backend.main:app.*--port ${BACKEND_PORT}" || true)"
      if [[ -n "${pids}" ]]; then
        info "Stopping existing backend process on port ${BACKEND_PORT}: ${pids//$'\n'/ }"
        pkill -f "uvicorn backend.main:app.*--port ${BACKEND_PORT}" || true
        sleep 1
      fi
    fi
  elif pid_alive "${pid_file}"; then
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

deploy_frontend() {
  if [[ -z "${PUBLIC_FRONTEND_DIR:-}" ]]; then
    return
  fi

  info "Publishing frontend to ${PUBLIC_FRONTEND_DIR}"
  if has_cmd sudo; then
    sudo mkdir -p "${PUBLIC_FRONTEND_DIR}"
    sudo cp -a "${ROOT_DIR}/frontend/." "${PUBLIC_FRONTEND_DIR}/"
    sudo chown -R www-data:www-data "${PUBLIC_FRONTEND_DIR}" 2>/dev/null || true
  else
    mkdir -p "${PUBLIC_FRONTEND_DIR}"
    cp -a "${ROOT_DIR}/frontend/." "${PUBLIC_FRONTEND_DIR}/"
  fi
}

start_frontend() {
  if [[ "${SKIP_FRONTEND_SERVER:-0}" == "1" ]]; then
    info "Skipping local frontend server because frontend is published to ${PUBLIC_FRONTEND_DIR}"
    return
  fi

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

Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}
Database: ${DB_TYPE}
Public frontend files: ${PUBLIC_FRONTEND_DIR:-not configured}
Local frontend server: $([[ "${SKIP_FRONTEND_SERVER:-0}" == "1" ]] && echo "skipped" || echo "http://${FRONTEND_HOST}:${FRONTEND_PORT}")

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
deploy_frontend
start_frontend
print_summary
