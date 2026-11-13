# Shared helpers for scripts/deploy/*.sh (sourced, not run). docs/runbooks/staging.md explains the setup.
# Every credential comes from the environment (a GitHub Actions environment's secrets and variables). Nothing
# here prints a secret: no `set -x`, API responses that carry keys are parsed and dropped, and generated values
# are masked in the Actions log before use.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_CLI="supabase@3.1.0" # same as the root package.json
WRANGLER_CLI="wrangler@4"

# The target environment: staging now; production reuses the same scripts with its own GitHub environment.
target_env() {
  case "${1:-}" in
    staging | production) printf %s "$1" ;;
    *) echo "usage: $0 staging|production" >&2; exit 2 ;;
  esac
}

require() {
  local missing=()
  for name in "$@"; do [[ -n "${!name:-}" ]] || missing+=("$name"); done
  if ((${#missing[@]})); then
    echo "missing: ${missing[*]} (set them on the GitHub environment; docs/runbooks/staging.md)" >&2
    exit 1
  fi
}

mask() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then echo "::add-mask::$1"; fi
}

supabase_cli() { npx -y "$SUPABASE_CLI" "$@"; }
wrangler() { (cd "$ROOT/workers/photos" && npx -y "$WRANGLER_CLI" "$@"); }

# Supabase Management API (https://api.supabase.com) with the access token.
supabase_api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-fsS -X "$method" "https://api.supabase.com/v1$path" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
  if [[ -n "$body" ]]; then args+=(-H 'content-type: application/json' --data-binary @-); fi
  if [[ -n "$body" ]]; then printf %s "$body" | curl "${args[@]}"; else curl "${args[@]}"; fi
}

# Runs SQL on the project's database through the Management API and prints the rows as JSON.
run_sql() {
  supabase_api POST "/projects/$SUPABASE_PROJECT_REF/database/query" "$(jq -n --arg q "$1" '{query: $q}')"
}

project_url() { printf 'https://%s.supabase.co' "$SUPABASE_PROJECT_REF"; }

# The project's anon key (public by design; the app ships it). The response also holds the service role key,
# so only the anon entry is kept and nothing else leaves this function.
anon_key() {
  supabase_api GET "/projects/$SUPABASE_PROJECT_REF/api-keys" |
    jq -r '[.[] | select(.name == "anon" or .type == "publishable")] | sort_by(.name != "anon") | .[0].api_key // empty'
}

# The photo Worker's origin. Staging uses <worker name>.<account subdomain>.workers.dev, because pickld.me's DNS is
# at GoDaddy, not on Cloudflare, so a custom domain such as photos-staging.pickld.me can't be attached yet.
worker_name() {
  local env="$1"
  awk -v section="[env.$env]" '$0 == section { found = 1; next } found && /^name *=/ { gsub(/[" ]/, "", $0); sub(/^name=/, "", $0); print; exit }' \
    "$ROOT/workers/photos/wrangler.toml"
}
worker_url() {
  local sub
  sub="$(curl -fsS "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r '.result.subdomain // empty')"
  [[ -n "$sub" ]] || { echo "Cloudflare account has no workers.dev subdomain yet (Workers & Pages → pick one)" >&2; exit 1; }
  printf 'https://%s.%s.workers.dev' "$(worker_name "$1")" "$sub"
}

bucket_name() { printf 'pickld-photos-%s' "$1"; }
r2_endpoint() { printf 'https://%s.r2.cloudflarestorage.com' "$CLOUDFLARE_ACCOUNT_ID"; }

# Names (never values) of the secrets that already exist.
supabase_secret_names() { supabase_cli secrets list --remote="$SUPABASE_PROJECT_REF" -o json | jq -r '.. | objects | .name? // empty'; }
worker_secret_names() { wrangler secret list --env "$1" --format json 2>/dev/null | jq -r '.. | objects | .name? // empty' || true; }
