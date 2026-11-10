#!/bin/bash
set -euo pipefail

echo "[OpsPilot Runner] Starting sandboxed build execution..."
echo "[OpsPilot Runner] Running as UID: $(id -u), GID: $(id -g)"

if [ "$(id -u)" -eq 0 ]; then
  echo "[OpsPilot Security Violation] Build runner cannot execute as root!" >&2
  exit 1
fi

# Detect package manager and install dependencies immutably
if [ -f "pnpm-lock.yaml" ]; then
  echo "[OpsPilot Runner] Detected pnpm-lock.yaml. Running pnpm install --frozen-lockfile..."
  pnpm install --frozen-lockfile
elif [ -f "yarn.lock" ]; then
  echo "[OpsPilot Runner] Detected yarn.lock. Running yarn install --immutable..."
  yarn install --immutable
elif [ -f "package-lock.json" ]; then
  echo "[OpsPilot Runner] Detected package-lock.json. Running npm ci..."
  npm ci
else
  echo "[OpsPilot Runner] No lockfile detected. Proceeding with caution..."
fi

# Execute customer-specified build command via argv without shell evaluation
if [ $# -gt 0 ]; then
  echo "[OpsPilot Runner] Executing direct argv arguments: $*"
  exec "$@"
elif [ -n "${OPSPILOT_BUILD_COMMAND:-}" ]; then
  echo "[OpsPilot Security Violation] OPSPILOT_BUILD_COMMAND string execution is disabled for security; pass argv arguments directly." >&2
  exit 1
fi

echo "[OpsPilot Runner] Build execution completed successfully."
