#!/usr/bin/env bash
# Deploys the shared-link site (apps/web) and the moderation console (apps/mod) to their Vercel projects for an
# environment. Each app is skipped until its project id is set on the GitHub environment. docs/runbooks/staging.md.
#   scripts/deploy/web.sh staging
# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$0")/lib.sh"
env="$(target_env "${1:-}")"
if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "no VERCEL_TOKEN on the GitHub environment: web apps skipped"
  exit 0
fi
require SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF VERCEL_TOKEN VERCEL_ORG_ID
cd "$ROOT"
url="$(project_url)"
anon="$(anon_key)"

vercel_env() {
  local project="$1" key="$2" value="$3" team=""
  [[ "$VERCEL_ORG_ID" == team_* ]] && team="&teamId=$VERCEL_ORG_ID"
  jq -n --arg k "$key" --arg v "$value" '{key: $k, value: $v, type: "encrypted", target: ["production", "preview"]}' |
    curl -fsS -X POST "https://api.vercel.com/v10/projects/$project/env?upsert=true$team" \
      -H "Authorization: Bearer $VERCEL_TOKEN" -H 'content-type: application/json' --data-binary @- >/dev/null
}

deploy_app() {
  local app="$1" project="$2"
  if [[ -z "$project" ]]; then
    echo "== apps/$app: no Vercel project id set, skipped"
    return
  fi
  echo "== apps/$app ($env)"
  # Server-side only, and public by design (rule 2: never a service key).
  vercel_env "$project" SUPABASE_URL "$url"
  vercel_env "$project" SUPABASE_ANON_KEY "$anon"
  if [[ "$app" == web ]]; then
    for name in SITE_URL APP_STORE_URL PLAY_STORE_URL APPLE_TEAM_ID ANDROID_CERT_SHA256; do
      value="${!name:-}"
      [[ "$name" == SITE_URL ]] && value="${WEB_URL:-}"
      [[ -n "$value" ]] && vercel_env "$project" "$name" "$value"
    done
  fi
  # The project's Root Directory (apps/web or apps/mod) is set in Vercel, so the CLI runs from the repo root.
  rm -rf .vercel
  VERCEL_PROJECT_ID="$project" npx -y vercel@latest pull --yes --environment=production --token "$VERCEL_TOKEN" >/dev/null
  VERCEL_PROJECT_ID="$project" npx -y vercel@latest build --prod --token "$VERCEL_TOKEN"
  VERCEL_PROJECT_ID="$project" npx -y vercel@latest deploy --prebuilt --prod --token "$VERCEL_TOKEN"
  rm -rf .vercel
}

export VERCEL_ORG_ID
deploy_app web "${VERCEL_PROJECT_ID_WEB:-}"
deploy_app mod "${VERCEL_PROJECT_ID_MOD:-}"
