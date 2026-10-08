#!/usr/bin/env bash
# Renders the app icon PNGs from frontend/assets/icon/icon.svg (see render.js for the list).
# Runs in the same pinned Playwright image as the e2e tests; re-run after editing the SVG.
set -euo pipefail

export MSYS_NO_PATHCONV=1
ROOT=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
IMAGE=$(sed -n 's/^ *image: *\([^ ]*\).*/\1/p' "$ROOT/devops/playwright/docker-compose.yml")

docker run --rm \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$ROOT/frontend:/frontend" \
  -v "$ROOT/devops/icons:/icons:ro" \
  -w /frontend/e2e \
  "$IMAGE" \
  sh -c 'npm ci --no-audit --no-fund --loglevel=error && NODE_PATH=/frontend/e2e/node_modules node /icons/render.js'
