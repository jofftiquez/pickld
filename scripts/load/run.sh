#!/usr/bin/env bash
# Runs scripts/load/feed.js against the local Supabase stack (M5-03) with k6 from its Docker image.
#   scripts/load/run.sh [VUS] [HOLD]      e.g. scripts/load/run.sh 50 2m
# Seeded readers' tokens are minted for this run from the local JWT secret in `supabase status`; no key is
# stored. For a longer feed, load scripts/perf/feed-seed.sql first. Local only: staging uses real tokens.
set -euo pipefail
cd "$(dirname "$0")/../.."
status="$(npx supabase status -o json 2>/dev/null)"
field() { node -e 'let s=process.argv[1];const j=JSON.parse(s.slice(s.indexOf("{")));process.stdout.write(j[process.argv[2]]??"")' "$status" "$1"; }
ids="$(docker exec supabase_db_pickld psql -U postgres -Atc \
  "select string_agg(id::text, ',') from auth.users where email in ('dale@pickld.test','jun@pickld.test','aya@pickld.test','mika@pickld.test')")"
tokens="$(JWT_SECRET="$(field JWT_SECRET)" IDS="$ids" node -e '
const { createHmac } = require("node:crypto");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
process.stdout.write(process.env.IDS.split(",").map((sub) => {
  const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  return body + "." + createHmac("sha256", process.env.JWT_SECRET).update(body).digest("base64url");
}).join(","));')"
docker run --rm -i --network host \
  -e API_URL=http://127.0.0.1:55421 -e ANON_KEY="$(field ANON_KEY)" -e TOKENS="$tokens" \
  -e VUS="${1:-50}" -e HOLD="${2:-2m}" \
  grafana/k6 run --summary-trend-stats 'med,p(95),p(99),max' - < scripts/load/feed.js
