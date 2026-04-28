#!/usr/bin/env bash
set -euo pipefail
cd /root/projects/mission-control
mkdir -p /root/projects/mission-control/state
export HOST=0.0.0.0
export PORT=3000
exec npm run start >> /root/projects/mission-control/state/mission-control.log 2>&1
