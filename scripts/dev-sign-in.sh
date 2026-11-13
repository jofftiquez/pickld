#!/usr/bin/env bash
# Prints a pickld://dev/sign-in link that signs a seeded user in on a dev build (local Supabase only).
#   scripts/dev-sign-in.sh dale@pickld.test
# Requests a sign-in email from local auth, reads its 6-digit code from Mailpit (D-60) and prints
#   pickld://dev/sign-in?email=<email>&code=<6 digits>
# It never stores a key: the anon key is read from `supabase status` at runtime. The code works once, for 10 minutes.
set -euo pipefail
email="${1:?usage: scripts/dev-sign-in.sh <email>}"
api="http://127.0.0.1:55421"
mail="http://127.0.0.1:55424"
anon="$(npx supabase status -o json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.slice(s.indexOf("{")));process.stdout.write(j.ANON_KEY||j.PUBLISHABLE_KEY)})')"
curl -fsS -X DELETE "$mail/api/v1/messages" >/dev/null || true
curl -fsS "$api/auth/v1/otp" -H "apikey: $anon" -H 'content-type: application/json' \
  -d "{\"email\":\"$email\",\"create_user\":false}" >/dev/null
for _ in $(seq 1 20); do
  id="$(curl -fsS "$mail/api/v1/search?query=to:$email" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).messages||[];process.stdout.write(m[0]?.ID??"")})')"
  [[ -n "$id" ]] && break
  sleep 0.5
done
[[ -n "${id:-}" ]] || { echo "no email for $email in Mailpit" >&2; exit 1; }
# The code-only emails put the code in the subject ("123456 is your Pickld code"); otherwise take the first 6-digit
# number in the text.
code="$(curl -fsS "$mail/api/v1/message/$id" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const m=(j.Subject||"").match(/^(\d{6})\b/)||(j.Text||"").match(/\b(\d{6})\b/);process.stdout.write(m?m[1]:"")})')"
[[ -n "$code" ]] || { echo "no 6-digit code in the email" >&2; exit 1; }
encoded="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]).replace(/%40/g, "@"))' "$email")"
echo "pickld://dev/sign-in?email=$encoded&code=$code"
