#!/usr/bin/env bash
# Deploys the web apps for an environment. docs/runbooks/staging.md, "Web site".
#   apps/web  pickld.me as a Cloudflare Worker (OpenNext). Production serves pickld.me and www.pickld.me; staging
#             serves pickld-web-staging.<subdomain>.workers.dev. Without SUPABASE_PROJECT_REF it deploys the
#             marketing pages only ("coming soon"): shared links 404 and the waitlist stays closed.
#   apps/mod  the moderation console as a Cloudflare Worker (OpenNext), once SUPABASE_PROJECT_REF is set.
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
  # Server action ids are hashed with this key, which Next.js otherwise makes up per build: a page opened before
  # a deploy would post an id the new Worker doesn't know and show "This page couldn't load". Derived from a
  # secret the deploy already has, so the ids stay the same across deploys. Never printed.
  if [[ -n "${TURNSTILE_SECRET_KEY:-}" ]]; then
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(printf 'pickld-web-server-actions:%s' "$TURNSTILE_SECRET_KEY" |
      openssl dgst -sha256 -binary | base64)"
    export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
  fi
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
  if [[ -z "$supabase_url" ]]; then
    echo "== apps/mod: no Supabase project, skipped"
    return
  fi
  require CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  echo "== apps/mod ($env, Cloudflare Worker)"
  # The console reads its settings on the server at request time; the build gets the same values.
  (cd apps/mod && SUPABASE_URL="$supabase_url" SUPABASE_ANON_KEY="$anon" pnpm cf:build)
  (cd apps/mod && pnpm exec wrangler deploy --env "$env" --var "SUPABASE_URL:$supabase_url")
  # The anon key is public by design, but it stays a Worker secret like pickld.me's; nothing is printed.
  printf %s "$anon" | (cd apps/mod && pnpm exec wrangler secret put SUPABASE_ANON_KEY --env "$env" >/dev/null)
}

deploy_site
deploy_console
