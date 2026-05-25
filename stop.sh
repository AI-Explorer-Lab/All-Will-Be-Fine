#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="${ROOT_DIR}/.run/pids"
DB_CONTAINER="${DB_CONTAINER:-all-will-be-fine-postgres}"

info() {
  printf '\033[1;34m[all-will-be-fine]\033[0m %s\n' "$*"
}

stop_pid() {
  local name="$1"
  local pid_file="${PID_DIR}/${name}.pid"

  if [[ ! -f "${pid_file}" ]]; then
    info "${name} is not tracked as running"
    return
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if kill -0 "${pid}" >/dev/null 2>&1; then
    info "Stopping ${name} with PID ${pid}"
    kill "${pid}" >/dev/null 2>&1 || true
  else
    info "${name} PID ${pid} is no longer running"
  fi
  rm -f "${pid_file}"
}

stop_pid frontend
stop_pid backend

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "${DB_CONTAINER}"; then
  info "Stopping Postgres container ${DB_CONTAINER}"
  docker stop "${DB_CONTAINER}" >/dev/null
else
  info "Postgres container ${DB_CONTAINER} is not running"
fi
