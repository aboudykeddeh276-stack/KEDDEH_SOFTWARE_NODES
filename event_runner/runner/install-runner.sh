#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_URL:?set RUNNER_URL, e.g. https://github.com/OWNER/REPO}"
: "${RUNNER_TOKEN:?set one-time GitHub runner registration token}"
NAME="${RUNNER_NAME:-kex-$(hostname)}"; LABELS="${RUNNER_LABELS:-kex,telemetry}"
mkdir -p "${HOME}/actions-runner"; cd "${HOME}/actions-runner"
if [[ ! -x ./config.sh ]]; then echo "BLOCKED:ACTIONS_RUNNER_BINARY_NOT_PRESENT"; exit 3; fi
./config.sh --unattended --url "$RUNNER_URL" --token "$RUNNER_TOKEN" --name "$NAME" --labels "$LABELS" --replace
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
