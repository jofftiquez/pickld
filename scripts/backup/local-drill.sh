#!/usr/bin/env bash
# Rehearses docs/runbooks/backup-restore.md on the local Supabase stack (M5-04): dumps the database,
# restores it into a fresh database, compares row counts and security objects, and prints the timings.
# Local only. It creates and drops a database called restore_drill and never touches `postgres`.
set -euo pipefail
C=supabase_db_pickld
SU=supabase_admin   # Supabase's superuser; `postgres` can't restore the realtime/auth schemas
q() { docker exec "$C" psql -U "$SU" -d "$1" -Atc "$2"; }
q postgres "drop database if exists restore_drill"
t0=$(date +%s.%N)
docker exec "$C" pg_dump -U "$SU" -Fc -d postgres -f /tmp/drill.dump
t1=$(date +%s.%N)
docker exec "$C" createdb -U "$SU" restore_drill
docker exec "$C" pg_restore -U "$SU" -d restore_drill --no-owner --exit-on-error /tmp/drill.dump
t2=$(date +%s.%N)
echo "dump $(docker exec "$C" stat -c %s /tmp/drill.dump) bytes in $(echo "$t1 - $t0" | bc) s; restore in $(echo "$t2 - $t1" | bc) s"
check="select (select count(*) from auth.users), (select count(*) from public.profiles), (select count(*) from public.jars),
  (select count(*) from public.moments), (select count(*) from public.follows), (select count(*) from public.comments),
  (select count(*) from pg_policies where schemaname = 'public'),
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal),
  (select count(*) from supabase_migrations.schema_migrations)"
echo "users|profiles|jars|moments|follows|comments|policies|triggers|migrations"
a=$(q postgres "$check"); b=$(q restore_drill "$check")
echo "source:   $a"; echo "restored: $b"
q postgres "drop database restore_drill"; docker exec "$C" rm -f /tmp/drill.dump
[[ "$a" == "$b" ]] && echo "MATCH" || { echo "MISMATCH"; exit 1; }
