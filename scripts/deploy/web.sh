#!/usr/bin/env bash
# Deploys the web apps for an environment. docs/runbooks/staging.md, "Web site".
#   apps/web  pickld.me as a Cloudflare Worker (OpenNext). Production serves pickld.me and www.pickld.me; staging
#             serves pickld-web-staging.<subdomain>.workers.dev. Without SUPABASE_PROJECT_REF it deploys the
#             marketing pages only ("coming soon"): shared links 404 and the waitlist stays closed.
#   apps/mod  the moderation console on Vercel, skipped until VERCEL_TOKEN and its project id are set.
#   scripts/deploy/web.sh production
# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$0")/lib.sh"
env="$(target_env "${1:-}")"
cd "$ROOT"

supabase_url="" anon=""
if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  require SUPABASE_ACCESS_TOKEN
  supabase_url="$(project_url)"
  anon="$(anon_key)"
fi

deploy_site() {
  require CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  echo "== apps/web ($env, Cloudflare Worker)"
  # Static pages read these at build time and the Worker at request time, so both get the same values.
  # The waitlist opens only when WAITLIST_OPEN=true is set on the GitHub environment and Supabase is set up.
  local open="false"
  if [[ "${WAITLIST_OPEN:-}" == "true" && -n "$supabase_url" ]]; then open="true"; fi
  export WAITLIST_OPEN="$open" SITE_URL="${WEB_URL:-}" APP_STORE_URL="${APP_STORE_URL:-}" \
    PLAY_STORE_URL="${PLAY_STORE_URL:-}" APPLE_TEAM_ID="${APPLE_TEAM_ID:-}" \
    ANDROID_CERT_SHA256="${ANDROID_CERT_SHA256:-}" TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY:-}"
  (cd apps/web && pnpm cf:build)

  local vars=(--var "WAITLIST_OPEN:$open")
  for name in SITE_URL APP_STORE_URL PLAY_STORE_URL APPLE_TEAM_ID ANDROID_CERT_SHA256 TURNSTILE_SITE_KEY; do
    if [[ -n "${!name}" ]]; then vars+=(--var "$name:${!name}"); fi
  done
  if [[ -n "$supabase_url" ]]; then vars+=(--var "SUPABASE_URL:$supabase_url"); fi
  (cd apps/web && pnpm exec wrangler deploy --env "$env" "${vars[@]}")

  # Server-only values as Worker secrets, through a 600 file that is removed on exit; nothing is printed.
  local secrets_file
  secrets_file="$(mktemp)"
  chmod 600 "$secrets_file"
  jq -n --arg anon "$anon" --arg ts "${TURNSTILE_SECRET_KEY:-}" --arg ws "${WAITLIST_SECRET:-}" \
    '{SUPABASE_ANON_KEY: $anon, TURNSTILE_SECRET_KEY: $ts, WAITLIST_SECRET: $ws} | with_entries(select(.value != ""))' \
    >"$secrets_file"
  if [[ "$(jq 'length' "$secrets_file")" != 0 ]]; then
    (cd apps/web && pnpm exec wrangler secret bulk "$secrets_file" --env "$env" >/dev/null)
  fi
  rm -f "$secrets_file"
}

deploy_console() {
  local project="${VERCEL_PROJECT_ID_MOD:-}"
  if [[ -z "${VERCEL_TOKEN:-}" || -z "$project" ]]; then
    echo "== apps/mod: no VERCEL_TOKEN or project id set, skipped"
    return
  fi
  if [[ -z "$supabase_url" ]]; then
    echo "== apps/mod: no Supabase project, skipped"
    return
  fi
  require VERCEL_ORG_ID
  echo "== apps/mod ($env, Vercel)"
  local team=""
  if [[ "$VERCEL_ORG_ID" == team_* ]]; then team="&teamId=$VERCEL_ORG_ID"; fi
  for pair in "SUPABASE_URL=$supabase_url" "SUPABASE_ANON_KEY=$anon"; do
    jq -n --arg k "${pair%%=*}" --arg v "${pair#*=}" '{key: $k, value: $v, type: "encrypted", target: ["production", "preview"]}' |
      curl -fsS -X POST "https://api.vercel.com/v10/projects/$project/env?upsert=true$team" \
        -H "Authorization: Bearer $VERCEL_TOKEN" -H 'content-type: application/json' --data-binary @- >/dev/null
  done
  # The project's Root Directory (apps/mod) is set in Vercel, so the CLI runs from the repo root.
  export VERCEL_ORG_ID
  rm -rf .vercel
  VERCEL_PROJECT_ID="$project" npx -y vercel@latest pull --yes --environment=production --token "$VERCEL_TOKEN" >/dev/null
  VERCEL_PROJECT_ID="$project" npx -y vercel@latest build --prod --token "$VERCEL_TOKEN"
  VERCEL_PROJECT_ID="$project" npx -y vercel@latest deploy --prebuilt --prod --token "$VERCEL_TOKEN"
  rm -rf .vercel
}

deploy_site
deploy_console
