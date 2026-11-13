# Local Supabase

Needs Docker. The CLI is a root dev dependency, so run it through pnpm.

| Command | What it does |
| --- | --- |
| `pnpm db:start` | Start the local stack (first run pulls images and takes a few minutes). |
| `pnpm db:reset` | Recreate the database, apply `migrations/` in order, then load `seed.sql`. |
| `pnpm db:types` | Regenerate `apps/mobile/src/lib/database.types.ts`. Commit it with every migration. |
| `pnpm db:types:check` | Fail if the committed types are stale (part of `scripts/ci.sh`). |
| `pnpm db:test` | Run the pgTAP suite in `tests/` (`supabase test db`). |
| `pnpm fn:test` | Run the Edge Function tests in `functions/tests/` against the running local stack (Deno). |

Local URLs: API `http://127.0.0.1:55421`, database `postgresql://postgres:postgres@127.0.0.1:55422/postgres`,
Studio `http://127.0.0.1:55423`, mail (Mailpit) `http://127.0.0.1:55424`.

`0001_init.sql` stays as delivered; every fix is an additive migration (`0002_…`, `0003_…`), and no column is
dropped or renamed (docs/decisions.md C-5).

## Seed data

`seed.sql` creates six accounts that sign in with an email code (`<name>@pickld.test`; the 6-digit code is in Mailpit, or use `scripts/dev-sign-in.sh`):
dale, mika, aya, jun, lola and pickld.mod (moderator). It includes full and partial jars, an unpublished jar, a
private moment, a moment in `checking`, a removed moment, a backfilled ("Added later") moment, follows, a block
(dale blocked lola), likes and comments. Dates are relative to today, so the data always looks current. Photo
paths point at `seed/photos/<name>.jpg`, matching the placeholders in `design/images/`.

## Database tests

Each `tests/*.sql` file runs in its own transaction and rolls back. Start every file with `begin; \ir _helpers.psql`.
The helpers create users and switch the Postgres role and JWT claims, so policies see exactly what a real
request would: `tests.world()` creates the standard cast (owner, reader, outsider, blocked, blocker, moderator),
`tests.act_as('reader')`, `tests.act_as_anon()`, `tests.act_as_service()`, `tests.reset_role()`,
`tests.set_status(moment, 'live')` (as `pickld_moderation`, the only role allowed to set live or removed),
`tests.make_jar(...)` and `tests.make_moment(...)`. Every RLS change ships with tests that try it as owner, reader,
outsider and blocked user, plus a control case that a too-strict rule would fail.

## Edge Functions

One folder per function (`functions/<name>/index.ts` serves, `handler.ts` holds the logic), shared code in
`functions/_shared/`. Every function validates input with Zod and answers `{ data } | { error }`; crashes are
reported to Sentry only when `SENTRY_DSN` is set. Functions act as the caller (RLS applies) and never use a
service key, except `moderate`: it checks the caller owns the moment, then applies the verdict with the runtime's
service key through `moderation_apply()`, the only path that sets a moment `live` or `removed` (migration 0011).
The app calls `moderate` with `{ momentId }` after inserting or changing a moment. Its provider is
`moderate/provider.ts`; the early version auto-approves (D-22).

`supabase start` serves them at `http://127.0.0.1:55421/functions/v1/<name>`. Their secrets (the photo bucket's
`S3_*` and `PHOTO_TOKEN_SECRET`) go in `functions/.env` (git-ignored; see `functions/.env.example`). Locally
`S3_*` are the Storage S3 values from `supabase status`. Run Deno commands from outside `functions/`, or use
`pnpm fn:test`: Deno's temporary files there make the local runtime restart.

Tests sign in throwaway users with a random password through the local Auth API (keys read from
`supabase status` at runtime) and delete them afterwards.
