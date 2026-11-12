# Runbook · Backup restore (NFR-REL-02, M5-04)

Use this when the production database must be rolled back, for example after a bad migration, data deleted by mistake, or a corrupted table. The staging drill (below) proves these steps before anyone needs them.

## What is backed up, and what isn't

| Data | Where it lives | Backup |
| --- | --- | --- |
| Accounts, jars, moments, follows, comments, reports, audit log | Supabase Postgres (Singapore) | Supabase's daily backups, kept for the plan's retention. Point-in-time recovery is a paid add-on and isn't enabled (it would need approval) |
| Photos, thumbnails, avatars, exports | Cloudflare R2 | **Not backed up.** A restore brings back rows whose photos still exist in R2. Photos deleted after the backup was taken stay deleted |
| Edge Function code, migrations | GitHub (`supabase/`) | The repository |
| Secrets (R2 keys, photo token, jobs secret) | Supabase function secrets, Vercel, EAS | The founders' password manager |

## Before restoring production

1. **Decide the restore point.** Pick the newest backup from before the incident. Anything written after it is lost: moments, comments, sign-ups.
2. **Stop writes.** Set the app's maintenance flag if there is one. Otherwise pause the `account-jobs` cron so no purge runs during the restore, and post the status message.
3. **Take a fresh dump of the current state**, so the damaged data can still be read afterwards:
   `pnpm exec supabase db dump --db-url "$PROD_DB_URL" -f before-restore.sql` plus `--data-only -f before-restore-data.sql`. The connection string comes from the dashboard and lives only in the shell; never commit it.

## Restore

**Preferred: restore into a new project, then switch.** Production keeps running read-only meanwhile.
1. Supabase dashboard → the project → Database → Backups. Download the chosen backup, or use "Restore to new project" if the plan offers it.
2. For a downloaded backup: create a project in the same region, then restore with the database superuser:
   `pg_restore --no-owner --exit-on-error -d "$NEW_DB_URL" backup.dump` (for a plain `.sql` backup: `psql -v ON_ERROR_STOP=1 -d "$NEW_DB_URL" -f backup.sql`).
3. Bring the migration history up to date: `pnpm exec supabase db push --db-url "$NEW_DB_URL"`. Apply only migrations newer than the backup.
4. Redeploy the Edge Functions and set their secrets on the new project (`supabase functions deploy`, `supabase secrets set`), then point the app's Supabase URL and anon key at it. The app reads these from EAS env (D-35), so this means a new EAS Update or build. Also update the web apps on Vercel.

**Faster but destructive: restore in place.** Dashboard → Database → Backups → Restore. It overwrites the current database and the project is unavailable while it runs. Use it only when the dump from step 3 above exists.

## Check before reopening

Run against the restored database (`scripts/backup/local-drill.sh` shows the same checks locally):
- Row counts for `auth.users`, `profiles`, `jars`, `moments`, `follows`, `comments` are close to the restore point's expected numbers.
- Every row of `supabase_migrations.schema_migrations` is there, and the numbers of `public` RLS policies and triggers match the repository.
- `fn:health` answers 200 (D-34).
- Sign in on a phone as a test reader. Check that the feed, a jar page and a photo load, and that a private moment stays hidden from the reader.
- Then reopen writes and resume the `account-jobs` cron.

## Staging drill (🔑 founders)

Do it once before beta, then after any change to backups or regions. Time each step and record the times below.
1. Note the row counts on staging, then wait for the next daily backup.
2. Write a few marker rows after it, such as a test comment.
3. Follow **Restore** into a new project. Check that the counts match the backup and that the marker rows are gone.
4. Record how long it took, and anything that didn't match these steps, and fix this runbook.

| Date | Who | Backup size | Restore time | End-to-end (stop writes → reopened) | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-11-12 | agent, local rehearsal | 0.87 MB (seed data) | 0.65 s `pg_restore` | — | `scripts/backup/local-drill.sh`: counts, 55 policies, 32 triggers and 27 migrations match. Must run as `supabase_admin`; `postgres` can't restore the realtime functions |
| | founders, staging | | | | |
