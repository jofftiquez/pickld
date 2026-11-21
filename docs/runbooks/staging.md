# Staging runbook (M1-28, #28)

Staging is an online copy of Pickld for the founders and invited testers. It has its own Supabase project, R2 bucket, photo Worker, web site Worker and Vercel console project, and shares nothing with production or with the local stack. Production later reuses the same scripts with its own GitHub environment (`production`) and its own accounts' projects.

**Staging is testers only.** Moderation auto-approves there until the OpenAI key and an approved child-safety matcher exist (D-22, D-41), so no real users and no public links.

## How it works

```
merge to main ──► ci (green) ──► deploy-staging (GitHub environment "staging")
                                   1. scripts/deploy/deploy.sh     R2 bucket, migrations, Edge Functions, photo Worker, sticker art
                                   2. scripts/deploy/configure.sh  function secrets, Worker token secret, cron jobs, auth redirects
                                   3. scripts/deploy/web.sh        apps/web as a Cloudflare Worker; apps/mod on Vercel (skipped until set up)
                                   4. scripts/deploy/smoke.sh      fn:health 200, sticker 200, user photo without token 403, cron calls
```

- **Run by hand:** Actions → deploy-staging → Run workflow, or `gh workflow run deploy-staging`.
- **Migrations only, never the seed.** `supabase/seed.sql` is local test data. Migrations stay additive (C-5): no drops or renames without the product owner.
- **Secrets nobody types.** `configure.sh` generates `PHOTO_TOKEN_SECRET` (same value on the Worker and in Supabase), `CONTACT_HASH_SECRET`, `PUSH_CRON_SECRET` and `ACCOUNT_JOBS_SECRET` with `openssl rand -hex 32` the first time, masks them in the log, and never prints them. They exist only in Supabase, Cloudflare and Supabase Vault. Re-running keeps them.
- **Cron jobs** (`scripts/deploy/cron.sql`, pg_cron + pg_net): `send-push` every minute, `account-jobs` every 2 minutes. They read the project URL, anon key and job secrets from Vault, so the SQL holds no secret.
- **Hostnames.** pickld.me's DNS is at GoDaddy, so staging uses provider hostnames (D-47):

| Piece                     | Staging address                                                      |
| ------------------------- | -------------------------------------------------------------------- |
| API, Auth, Edge Functions | `https://<ref>.supabase.co`                                          |
| Photo Worker              | `https://pickld-photos-staging.<subdomain>.workers.dev`              |
| Web site (`apps/web`)     | `https://pickld-web-staging.<subdomain>.workers.dev` (set `WEB_URL`) |
| Moderation console        | the `apps/mod` Vercel project's `*.vercel.app` (set `MOD_URL`)       |

## GitHub environment `staging`

Repository → Settings → Environments → New environment → `staging`. Optionally limit it to the `main` branch.

| Name                                                                                                      | Kind      | Where it comes from                                                                                           | Needed for               |
| --------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `SUPABASE_PROJECT_REF`                                                                                    | variable  | the staging project's ref (Project Settings → General)                                                        | everything               |
| `SUPABASE_ACCESS_TOKEN`                                                                                   | secret    | supabase.com/dashboard/account/tokens                                                                         | everything               |
| `SUPABASE_DB_PASSWORD`                                                                                    | secret    | the database password chosen when creating the project                                                        | migrations               |
| `CLOUDFLARE_ACCOUNT_ID`                                                                                   | variable  | Cloudflare dashboard, right sidebar of the account home                                                       | everything               |
| `CLOUDFLARE_API_TOKEN`                                                                                    | secret    | My Profile → API Tokens → custom token: Account · Workers Scripts · Edit, Account · Workers R2 Storage · Edit | Worker, bucket           |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`                                                                | secrets   | R2 → Manage API tokens → Object Read & Write, limited to `pickld-photos-staging`                              | uploads, stickers        |
| `VERCEL_TOKEN`                                                                                            | secret    | vercel.com/account/tokens                                                                                     | web apps                 |
| `VERCEL_ORG_ID`                                                                                           | variable  | Vercel team settings (`team_…`) or the personal account id                                                    | web apps                 |
| `VERCEL_PROJECT_ID_MOD`                                                                                   | variables | each project's Settings → General                                                                             | web apps                 |
| `WEB_URL`, `MOD_URL`                                                                                      | variables | the staging web Worker's workers.dev URL and the console's `*.vercel.app` URL                                 | links                    |
| `SENTRY_DSN`, `OPENAI_API_KEY`, `EXPO_ACCESS_TOKEN`, `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_SECRET_KEY` | secrets   | optional, when those accounts exist                                                                           | passed to Edge Functions |
| `WAITLIST_SECRET`                                                                                         | secret    | optional: `openssl rand -hex 32`; until it is set, the pickld.me waitlist form shows "try again"              | fn:waitlist-join, web    |
| `RESEND_API_KEY`                                                                                          | secret    | optional: Resend → API Keys, sending access (`waitlist-codes.md`)                                             | fn:waitlist-send         |
| `EMAIL_FROM`                                                                                              | variable  | optional: `Pickld <hello@mail.pickld.me>`, on the domain verified in Resend                                   | fn:waitlist-send         |
| `OPENAI_VISION_MODEL`, `APP_STORE_URL`, `PLAY_STORE_URL`, `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256`          | variables | optional                                                                                                      | functions, web           |

Never paste any of these into chat, an issue or the repo.

## First-time setup (founders)

Each step is a click in a dashboard; the agent does the rest.

1. **Supabase.** New project `pickld-staging`, region Southeast Asia (Singapore), Free plan. Store the database password in the password manager. Create the `staging` GitHub environment and set `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
2. **Cloudflare.** Create the account (or use the existing one). R2 asks for a payment method before it turns on; staging stays inside the free allowance, but adding a card is the founders' call. Then:
   - Workers & Pages → pick a workers.dev subdomain.
   - R2 → Create bucket `pickld-photos-staging`, location Asia-Pacific, no public access.
   - The API token and the R2 token from the table above, set on the environment with `CLOUDFLARE_ACCOUNT_ID`.
3. **First deploy.** The agent runs deploy-staging and reads the smoke test.
4. **Vercel (console only).** One project from `jofftiquez/pickld`: Root Directory `apps/mod`, framework Next.js, with Git auto-deploys off (GitHub Actions deploys after `ci`). Set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_MOD`, `WEB_URL` and `MOD_URL`, then rerun deploy-staging.
5. **App on staging (EAS, D-35).** In the Expo project's `preview` environment, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public values; the agent can read them out of the deploy log's project URL and the dashboard), then `npx eas-cli build --profile preview --platform ios`.
6. **A moderator.** In the staging SQL editor, after that person signs up: `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"moderator"}' where email = '<email>';`

## Web site (pickld.me)

`apps/web` runs as a Cloudflare Worker built by OpenNext (`pnpm --filter @pickld/web cf:build`, config in `apps/web/wrangler.jsonc`). `scripts/deploy/web.sh <env>` builds it, deploys it with `wrangler deploy --env <env>` and sets its settings: public values as Worker variables (`SITE_URL`, `TURNSTILE_SITE_KEY`, store links, `WAITLIST_OPEN`, `SUPABASE_URL`) and server-only values as Worker secrets (`SUPABASE_ANON_KEY`, `TURNSTILE_SECRET_KEY`, `WAITLIST_SECRET`). The same `CLOUDFLARE_API_TOKEN` deploys it; production also needs Zone · Workers Routes · Edit and Zone · DNS · Edit on pickld.me, because the Worker serves `pickld.me` and `www.pickld.me` as custom domains (no other A, AAAA or CNAME record may exist on those names).

- **Production** is deployed by hand: Actions → deploy-production → Run workflow (GitHub environment `production`). It needs only `CLOUDFLARE_ACCOUNT_ID` (variable) and `CLOUDFLARE_API_TOKEN` (secret) to ship the site as "coming soon".
- **Coming soon.** Without `SUPABASE_PROJECT_REF` the site ships the marketing and legal pages only; shared links 404.
- **The waitlist switch.** The waitlist opens only when the variable `WAITLIST_OPEN` is `true` and Supabase is set up. Closed, the forms and Join links are hidden, the copy says "coming soon", `/waitlist` and `/waitlist/code` 404 and the server actions send nothing. Opening it also needs `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` and Supabase Auth's SMTP sender.
- **Free plan:** 100,000 Worker requests a day and 10 ms CPU per request; static files are free and don't count. Enough for coming soon; move to Workers Paid when shared links and link previews go live.

## Check it

- `scripts/deploy/smoke.sh staging` (the workflow's last step) shows `ok` for fn:health, the sticker and the 403.
- In the staging SQL editor: `select jobname, schedule from cron.job;` lists `send-push` and `account-jobs`; `select status_code, count(*) from net._http_response group by 1;` shows 200s after a few minutes.
- Sign in on a preview build, add a moment, and confirm it goes Checking → live and its photo loads.

## Known limits on staging

- **Sign-in email uses Supabase's built-in sender.** It only delivers to addresses that are members of the Supabase organization, and a few emails an hour. Invite each tester to the Supabase organization (no project access needed beyond that) or wait for the SMTP step below.
- **Sign in with Apple** works on iOS builds once the App ID `me.pickld.app` has the Sign in with Apple capability; `configure.sh` turns Apple on in Supabase Auth. There is no Google sign-in.
- **App links** (`WEB_BASE_URL` in the app) still point at `https://pickld.me`, which is a placeholder today. Share cards and legal links open that placeholder until pickld.me serves `apps/web`.
- **Free plan:** the project pauses after a week without traffic (Restore in the dashboard), and there are no downloadable daily backups. M1-28's "daily backups on" and the backup drill (docs/runbooks/backup-restore.md) need a paid plan, which waits for the founders.

## Later (not part of staging yet)

- **Sign-in email (SMTP).** The provider is Resend (the same account sends waitlist codes). Follow `waitlist-codes.md`, steps 1 to 3 and 6: verify `mail.pickld.me`, then set Resend's SMTP in Supabase → Authentication → SMTP. Then raise the email rate limit and drop the organization-member restriction above.
- **Custom hostnames** (`staging.pickld.me`, `mod-staging.pickld.me`, `photos-staging.pickld.me`): move pickld.me's DNS to Cloudflare, or add a CNAME for the Vercel console. The Worker needs the zone on Cloudflare for a custom domain.
- **Sentry, PostHog and alerts** (D-34, docs/runbooks/alerts.md), then the staging drills: alerts (#110), load test (#116), restore (#117), PostHog events (#119), location audit (#120: `deno task exif-check` with a read-only R2 token).
- **OpenAI key and the child-safety matcher** before anyone outside the team uses staging.
- **RevenueCat sandbox** (docs/runbooks/revenuecat.md): point its webhook at the staging function.
- **Production:** a `production` GitHub environment with its own projects, deployed from release tags (M1-28 acceptance) rather than every merge.
