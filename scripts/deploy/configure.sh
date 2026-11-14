#!/usr/bin/env bash
# Configures an environment after deploy.sh: Edge Function secrets, the photo Worker's token secret, the cron jobs
# and Supabase Auth's redirect allow list and email code. Safe to run on every deploy: random secrets are generated only when
# missing, and nothing is printed. docs/runbooks/staging.md.
#   scripts/deploy/configure.sh staging
# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$0")/lib.sh"
env="$(target_env "${1:-}")"
require SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID \
  R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
export SUPABASE_ACCESS_TOKEN CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
cd "$ROOT"

secrets_file="$(mktemp)"
trap 'rm -f "$secrets_file"' EXIT
chmod 600 "$secrets_file"
add_secret() { printf '%s=%s\n' "$1" "$2" >>"$secrets_file"; }
random_secret() { local v; v="$(openssl rand -hex 32)"; mask "$v"; printf %s "$v"; }

# A value written into SQL below must be plain (hex, a URL or a JWT), never something with a quote in it.
sql_safe() { [[ "$1" =~ ^[A-Za-z0-9._:/-]+$ ]] || { echo "refusing to put an unexpected value into SQL" >&2; exit 1; }; }
vault_set() {
  sql_safe "$2"
  run_sql "do \$\$ declare sid uuid; begin
    select id into sid from vault.secrets where name = '$1';
    if sid is null then perform vault.create_secret('$2', '$1'); else perform vault.update_secret(sid, '$2'); end if;
  end \$\$;" >/dev/null
}

has() { grep -qx "$1" <<<"$2"; }
fn_secrets="$(supabase_secret_names)"
worker_secrets="$(worker_secret_names "$env")"
vault_names="$(run_sql 'select name from vault.secrets' | jq -r '.[].name')"

echo "== Edge Function secrets ($env)"
url="$(project_url)"
anon="$(anon_key)"
[[ -n "$anon" ]] || { echo "could not read the project's anon key" >&2; exit 1; }
photo_base="$(worker_url "$env")"

add_secret APP_ENV "$env"
add_secret S3_ENDPOINT "$(r2_endpoint)"
add_secret S3_REGION auto
add_secret S3_BUCKET "$(bucket_name "$env")"
add_secret S3_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
add_secret S3_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
add_secret PHOTO_BASE_URL "$photo_base"
add_secret CSAM_MATCHER hash-list
# Optional keys: set on the GitHub environment when the account exists, and the next deploy passes them on.
for name in SENTRY_DSN OPENAI_API_KEY OPENAI_VISION_MODEL EXPO_ACCESS_TOKEN REVENUECAT_WEBHOOK_SECRET \
  REVENUECAT_SECRET_KEY WAITLIST_SECRET; do
  [[ -n "${!name:-}" ]] && add_secret "$name" "${!name}"
done

# The photo token secret signs URLs in fn:photo-urls and is checked by the Worker, so both get the same value.
# If either is missing, both get a new one (tokens live 15 minutes, so rotating is harmless).
if ! has PHOTO_TOKEN_SECRET "$fn_secrets" || ! has PHOTO_TOKEN_SECRET "$worker_secrets"; then
  echo "new PHOTO_TOKEN_SECRET"
  v="$(random_secret)"
  add_secret PHOTO_TOKEN_SECRET "$v"
  printf %s "$v" | wrangler secret put PHOTO_TOKEN_SECRET --env "$env" >/dev/null
fi
# Contact hashes are keyed with this; it is set once (changing it means truncating public.contact_hashes).
if ! has CONTACT_HASH_SECRET "$fn_secrets"; then
  echo "new CONTACT_HASH_SECRET"
  add_secret CONTACT_HASH_SECRET "$(random_secret)"
fi
# The cron jobs send these headers, so each lives as a function secret and in Vault with the same value.
for pair in PUSH_CRON_SECRET:push_cron_secret ACCOUNT_JOBS_SECRET:account_jobs_secret; do
  name="${pair%%:*}" vault_name="${pair##*:}"
  if ! has "$name" "$fn_secrets" || ! has "$vault_name" "$vault_names"; then
    echo "new $name"
    v="$(random_secret)"
    add_secret "$name" "$v"
    vault_set "$vault_name" "$v"
  fi
done
supabase_cli secrets set --remote="$SUPABASE_PROJECT_REF" --env-file "$secrets_file" >/dev/null

echo "== Cron jobs ($env)"
vault_set project_url "$url"
vault_set anon_key "$anon"
run_sql "$(cat scripts/deploy/cron.sql)" >/dev/null
run_sql "select jobname, schedule from cron.job order by jobname" | jq -r '.[] | "\(.jobname)  \(.schedule)"'

echo "== Auth redirects and email code ($env)"
# Apple and Google sign-in return to pickld://auth/callback. Email sign-in (the app and the console) sends a
# 6-digit code that works for 10 minutes and no link (D-60), the same as otp_length and otp_expiry in
# supabase/config.toml. Email is Supabase's built-in sender until an SMTP provider is chosen (runbook, "Later").
redirects="pickld://auth/callback"
site="${WEB_URL:-https://pickld.me}"
supabase_api PATCH "/projects/$SUPABASE_PROJECT_REF/config/auth" \
  "$(jq -n --arg site "$site" --arg list "$redirects" \
    '{site_url: $site, uri_allow_list: $list, mailer_otp_length: 6, mailer_otp_exp: 600}')" >/dev/null
echo "site $site; redirects $redirects; email code 6 digits, 10 minutes"
