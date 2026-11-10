#!/usr/bin/env bash
# Generates apps/mobile/src/lib/database.types.ts from the local Supabase database.
#   scripts/db-types.sh          write the file
#   scripts/db-types.sh --check  fail if the committed file is stale (run after `supabase db reset`)
set -euo pipefail
cd "$(dirname "$0")/.."
out=apps/mobile/src/lib/database.types.ts
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
pnpm exec supabase gen types typescript --schema public 2>/dev/null \
  | pnpm exec prettier --parser typescript --stdin-filepath "$out" > "$tmp"
if [[ "${1:-}" == "--check" ]]; then
  if ! diff -u "$out" "$tmp"; then
    echo "db-types: $out is stale. Run 'pnpm db:types' and commit the result." >&2
    exit 1
  fi
  echo "db-types: up to date"
else
  mv "$tmp" "$out"
  echo "db-types: wrote $out"
fi
