# Local Supabase

Needs Docker. The CLI is a root dev dependency, so run it through pnpm.

| Command | What it does |
| --- | --- |
| `pnpm db:start` | Start the local stack (first run pulls images and takes a few minutes). |
| `pnpm db:reset` | Recreate the database, apply `migrations/` in order, then load `seed.sql`. |
| `pnpm db:types` | Regenerate `apps/mobile/src/lib/database.types.ts`. Commit it with every migration. |
| `pnpm db:types:check` | Fail if the committed types are stale (part of `scripts/ci.sh`). |

Local URLs: API `http://127.0.0.1:54321`, database `postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
Studio `http://127.0.0.1:54323`, mail (Mailpit) `http://127.0.0.1:54324`.

`0001_init.sql` stays as delivered; every fix is an additive migration (`0002_…`, `0003_…`), and no column is
dropped or renamed (docs/decisions.md C-5).

## Seed data

`seed.sql` creates six accounts that sign in with an email link (`<name>@pickld.test`; open the link from Mailpit):
dale, mika, aya, jun, lola and pickld.mod (moderator). It includes full and partial jars, an unpublished jar, a
private moment, a moment in `checking`, a removed moment, a backfilled ("Added later") moment, follows, a block
(dale blocked lola), likes and comments. Dates are relative to today, so the data always looks current. Photo
paths point at `seed/photos/<name>.jpg`, matching the placeholders in `design/images/`.
