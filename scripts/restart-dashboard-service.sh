#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/root/projects/mission-control"
UNIT_NAME="mission-control-dashboard"
UNIT_FILE="${UNIT_NAME}.service"
PORT="3000"

if ! command -v systemd-run >/dev/null 2>&1; then
  echo "systemd-run is required to restart the dashboard service." >&2
  exit 1
fi

current_pid="$({ ss -ltnp "( sport = :${PORT} )" 2>/dev/null || true; } | awk -F'pid=' '/next-server/ { split($2, parts, ","); print parts[1]; exit }')"

if systemctl list-units --all --full | grep -Fq "${UNIT_FILE}"; then
  systemctl stop "${UNIT_FILE}" >/dev/null 2>&1 || true
fi

if [[ -n "${current_pid}" ]] && kill -0 "${current_pid}" >/dev/null 2>&1; then
  kill "${current_pid}"
  sleep 1
fi

systemd-run \
  --unit="${UNIT_NAME}" \
  --description="Mission Control Dashboard" \
  --same-dir \
  /bin/bash -lc "cd '${REPO_ROOT}' && exec '${REPO_ROOT}/scripts/run-dashboard.sh'"

systemctl status "${UNIT_FILE}" --no-pager --lines=20
