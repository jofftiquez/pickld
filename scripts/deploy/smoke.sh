#!/usr/bin/env bash
# Checks a deployed environment answers: fn:health (database and photo bucket), a sticker through the photo
# Worker, and that both cron jobs reached their functions. docs/runbooks/staging.md.
#   scripts/deploy/smoke.sh staging
# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$0")/lib.sh"
env="$(target_env "${1:-}")"
require SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
cd "$ROOT"
failed=0
check() { # name, expected, actual
  if [[ "$2" == "$3" ]]; then echo "ok    $1 → $3"; else echo "FAIL  $1 → $3 (expected $2)"; failed=1; fi
}

anon="$(anon_key)"
check "fn:health" 200 "$(curl -sS -o /dev/null -w '%{http_code}' "$(project_url)/functions/v1/health" \
  -H "Authorization: Bearer $anon" -H "apikey: $anon")"

worker="$(worker_url "$env")"
sticker="$(cd assets && find stickers -name '*.png' | sort | head -1)"
check "sticker via photo Worker" 200 "$(curl -sS -o /dev/null -w '%{http_code}' "$worker/$sticker")"
check "user photo without a token" 403 "$(curl -sS -o /dev/null -w '%{http_code}' \
  "$worker/moments/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000/full.jpg")"

# Cron calls from the last 10 minutes (empty right after the first deploy; they start within 2 minutes).
run_sql "select status_code, count(*)::int as n from net._http_response
  where created > now() - interval '10 minutes' group by status_code order by status_code" |
  jq -r 'if length == 0 then "cron  no calls yet" else .[] | "cron  HTTP \(.status_code // "error") × \(.n)" end'

exit "$failed"
