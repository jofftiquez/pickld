#!/usr/bin/env bash
# Deploys main to an environment: the photo bucket, database migrations, Edge Functions, the photo Worker and
# the sticker art. Runs in GitHub Actions (.github/workflows/staging.yml) after `ci` passes on main; configure.sh
# runs next. docs/runbooks/staging.md.
#   scripts/deploy/deploy.sh staging
# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$0")/lib.sh"
env="$(target_env "${1:-}")"
require SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID \
  R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
export SUPABASE_ACCESS_TOKEN CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
cd "$ROOT"
bucket="$(bucket_name "$env")"

echo "== Photo bucket $bucket"
# Private (no public access, no r2.dev URL): the Worker is the only reader. Created once, never changed after.
if wrangler r2 bucket info "$bucket" >/dev/null 2>&1; then
  echo "exists"
else
  wrangler r2 bucket create "$bucket" --location apac
fi

echo "== Migrations ($env)"
# Migrations only: supabase/seed.sql is local test data and never runs here.
supabase_cli db push --remote="$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --skip-vault --yes

echo "== Edge Functions ($env)"
# Every folder with an index.ts (not _shared or tests). Per-function settings such as revenuecat-webhook's
# verify_jwt = false come from supabase/config.toml.
mapfile -t functions < <(cd supabase/functions && for d in */; do [[ -f "$d/index.ts" ]] && echo "${d%/}"; done)
supabase_cli functions deploy --remote="$SUPABASE_PROJECT_REF" --use-api --yes "${functions[@]}"

echo "== Photo Worker ($env)"
wrangler deploy --env "$env"

echo "== Sticker art ($env)"
# Existing keys are skipped (art never changes under a key), so this only uploads new stickers.
(cd workers/photos && S3_ENDPOINT="$(r2_endpoint)" S3_REGION=auto S3_BUCKET="$bucket" \
  S3_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" S3_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" deno task stickers)
