#!/usr/bin/env bash
# CopilotKit frontend on :3000. Run from the repo root, in a second terminal.
set -euo pipefail
cd "$(dirname "$0")/frontend"
npm install
exec npm run dev
