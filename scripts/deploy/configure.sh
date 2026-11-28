#!/usr/bin/env bash
# Configures an environment after deploy.sh: Edge Function secrets, the photo Worker's token secret, the cron jobs
# and Supabase Auth (redirect allow list, email code, email templates, Resend SMTP, Apple). Safe to run on every
# deploy: random secrets are generated only when missing, and nothing is printed. docs/runbooks/staging.md.
#   scripts/deploy/configure.sh staging
# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$0")/lib.sh"
env="$(target_env "${1:-}")"
require SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF
export SUPABASE_ACCESS_TOKEN
if photos_configured; then
  require CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
fi
cd "$ROOT"

secrets_file="$(mktemp)"
trap 'rm -f "$secrets_file"' EXIT
chmod 600 "$secrets_file"
add_secret() { printf '%s=%s\n' "$1" "$2" >>"$secrets_file"; }
# Sets $secret to a new random value and masks it in the Actions log. Not called as $(…): the mask command must
# reach the log, not the captured value.
new_secret() { secret="$(openssl rand -hex 32)"; mask "$secret"; }

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
worker_secrets=""
if photos_configured; then worker_secrets="$(worker_secret_names "$env")"; fi
vault_names="$(run_sql 'select name from vault.secrets' | jq -r '.[].name')"

echo "== Edge Function secrets ($env)"
url="$(project_url)"
anon="$(anon_key)"
[[ -n "$anon" ]] || { echo "could not read the project's anon key" >&2; exit 1; }

add_secret APP_ENV "$env"
add_secret CSAM_MATCHER hash-list
# Links in emails (fn:waitlist-send) point at this environment's web site.
add_secret SITE_URL "${WEB_URL:-https://pickld.me}"
# Optional keys: set on the GitHub environment when the account exists, and the next deploy passes them on.
for name in SENTRY_DSN OPENAI_API_KEY OPENAI_VISION_MODEL EXPO_ACCESS_TOKEN REVENUECAT_WEBHOOK_SECRET \
  REVENUECAT_SECRET_KEY WAITLIST_SECRET RESEND_API_KEY EMAIL_FROM APPLE_TEAM_ID APPLE_SIGN_IN_KEY_ID APPLE_SIGN_IN_KEY; do
  [[ -n "${!name:-}" ]] && add_secret "$name" "${!name}"
done

if photos_configured; then
  add_secret S3_ENDPOINT "$(r2_endpoint)"
  add_secret S3_REGION auto
  add_secret S3_BUCKET "$(bucket_name "$env")"
  add_secret S3_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
  add_secret S3_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
  add_secret PHOTO_BASE_URL "$(worker_url "$env")"
  # The photo token secret signs URLs in fn:photo-urls and is checked by the Worker, so both get the same value.
  # If either is missing, both get a new one (tokens live 15 minutes, so rotating is harmless).
  if ! has PHOTO_TOKEN_SECRET "$fn_secrets" || ! has PHOTO_TOKEN_SECRET "$worker_secrets"; then
    echo "new PHOTO_TOKEN_SECRET"
    new_secret
    add_secret PHOTO_TOKEN_SECRET "$secret"
    printf %s "$secret" | wrangler secret put PHOTO_TOKEN_SECRET --env "$env" >/dev/null
  fi
fi
# Contact hashes are keyed with this; it is set once (changing it means truncating public.contact_hashes).
if ! has CONTACT_HASH_SECRET "$fn_secrets"; then
  echo "new CONTACT_HASH_SECRET"
  new_secret
  add_secret CONTACT_HASH_SECRET "$secret"
fi
# The cron jobs send these headers, so each lives as a function secret and in Vault with the same value.
for pair in PUSH_CRON_SECRET:push_cron_secret ACCOUNT_JOBS_SECRET:account_jobs_secret; do
  name="${pair%%:*}" vault_name="${pair##*:}"
  if ! has "$name" "$fn_secrets" || ! has "$vault_name" "$vault_names"; then
    echo "new $name"
    new_secret
    add_secret "$name" "$secret"
    vault_set "$vault_name" "$secret"
  fi
done
supabase_cli secrets set --remote="$SUPABASE_PROJECT_REF" --env-file "$secrets_file" >/dev/null

echo "== Cron jobs ($env)"
vault_set project_url "$url"
vault_set anon_key "$anon"
run_sql "$(cat scripts/deploy/cron.sql)" >/dev/null
run_sql "select jobname, schedule from cron.job order by jobname" | jq -r '.[] | "\(.jobname)  \(.schedule)"'

echo "== Auth redirects, email code, templates, SMTP and Apple ($env)"
# Email sign-in (the app, the console and the pickld.me waitlist) sends a 6-digit code that works for 10 minutes
# and no link (D-60), the same as otp_length and otp_expiry in supabase/config.toml; an older email link returns to
# pickld://auth/callback. Native Sign in with Apple sends Auth an identity token for the app's bundle id, which
# needs no secret (config.toml, auth.external.apple).
redirects="pickld://auth/callback"
site="${WEB_URL:-https://pickld.me}"
apple_ids="me.pickld.app"
auth="$(jq -n --arg site "$site" --arg list "$redirects" --arg apple "$apple_ids" \
  '{site_url: $site, uri_allow_list: $list, mailer_otp_length: 6, mailer_otp_exp: 600,
    external_apple_enabled: true, external_apple_client_id: $apple}')"

# The branded emails: each [auth.email.template.<name>] and [auth.email.notification.<name>] section of
# config.toml (subject, content_path, and enabled for notifications), the same ones the local stack sends.
# They go up with the SMTP settings below, since hosted Auth keeps its default emails on the built-in sender.
emails="{}"
while IFS=$'\t' read -r kind name subject path enabled; do
  if [[ "$kind" == template ]]; then key="$name"; else key="${name}_notification"; fi
  emails="$(jq --arg s "$subject" --rawfile c "$ROOT/$path" --arg k "$key" '. + {
    ("mailer_subjects_" + $k): $s, ("mailer_templates_" + $k + "_content"): $c}' <<<"$emails")"
  if [[ "$kind" == notification ]]; then
    emails="$(jq --argjson on "$enabled" --arg n "$name" '. + {("mailer_notifications_" + $n + "_enabled"): $on}' <<<"$emails")"
  fi
done < <(awk '
  function flush() { if (kind != "") printf "%s\t%s\t%s\t%s\t%s\n", kind, name, subject, path, (enabled == "" ? "false" : enabled) }
  /^\[/ { flush(); kind = ""; subject = ""; path = ""; enabled = ""
    if (match($0, /^\[auth\.email\.(template|notification)\.[a-z_]+\]$/)) {
      split(substr($0, 2, length($0) - 2), part, "."); kind = part[3]; name = part[4] } next }
  kind != "" && /^subject *= *"/ { subject = $0; sub(/^subject *= *"/, "", subject); sub(/"$/, "", subject) }
  kind != "" && /^content_path *= *"/ { path = $0; sub(/^content_path *= *"(\.\/)?/, "", path); sub(/"$/, "", path) }
  kind != "" && /^enabled *= */ { enabled = $0; sub(/^enabled *= */, "", enabled) }
  END { flush() }' "$ROOT/supabase/config.toml")

# Resend's SMTP (docs/runbooks/waitlist-codes.md) once RESEND_API_KEY and EMAIL_FROM are set: Supabase's built-in
# sender only reaches members of the Supabase organization, a few emails an hour.
if [[ -n "${RESEND_API_KEY:-}" && -n "${EMAIL_FROM:-}" ]]; then
  from_address="$(sed -E 's/.*<([^>]+)>.*/\1/' <<<"$EMAIL_FROM")"
  from_name="$(sed -E 's/ *<[^>]*> *$//' <<<"$EMAIL_FROM")"
  [[ "$from_name" == "$EMAIL_FROM" ]] && from_name="Pickld"
  auth="$(jq --argjson emails "$emails" --arg pass "$RESEND_API_KEY" --arg from "$from_address" --arg name "$from_name" '. + $emails + {
    smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_pass: $pass,
    smtp_admin_email: $from, smtp_sender_name: $name, rate_limit_email_sent: 60}' <<<"$auth")"
  smtp="Resend SMTP as $from_address, 60 emails an hour, $(jq '[keys[] | select(startswith("mailer_templates_"))] | length' <<<"$emails") Pickld email templates"
else
  smtp="built-in sender (no RESEND_API_KEY and EMAIL_FROM)"
fi
supabase_api PATCH "/projects/$SUPABASE_PROJECT_REF/config/auth" "$auth" >/dev/null
echo "site $site; redirects $redirects; email code 6 digits, 10 minutes; $smtp; Apple for $apple_ids"
