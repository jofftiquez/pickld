#!/usr/bin/env bash
# Same steps as .github/workflows/ci.yml, for running locally before a merge
# (used while GitHub Actions is unavailable on this account; see docs/decisions.md D-19).
# Needs Docker for the local Supabase stack.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm exec supabase status > /dev/null 2>&1 || pnpm db:start
pnpm db:reset
pnpm db:types:check
pnpm db:test
echo "ci: all steps passed"
