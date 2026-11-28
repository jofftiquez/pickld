# Production runbook

Production uses the same scripts as staging (`scripts/deploy/`, `docs/runbooks/staging.md`) with the GitHub environment `production` and its own Supabase project, R2 bucket and Workers. It deploys only by hand: Actions → deploy-production → Run workflow.

## What a run does

| Set on `production`                       | What ships                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare only (today)                   | pickld.me as "coming soon": marketing and legal pages, waitlist closed, shared links 404                                                                                                           |
| + Supabase (`SUPABASE_PROJECT_REF` …)     | migrations, every Edge Function, function secrets, cron jobs, Auth (6-digit code, branded emails, Apple), then pickld.me with Supabase and the moderation console (Worker `pickld-mod-production`) |
| + Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | Auth sends through Resend's SMTP instead of Supabase's built-in sender                                                                                                                             |
| + Turnstile and `WAITLIST_OPEN=true`      | the pickld.me waitlist opens                                                                                                                                                                       |
| + R2 keys                                 | the `pickld-photos-production` bucket, the photo Worker on `photos.pickld.me`, sticker art, and the storage half of `fn:health`                                                                    |

Every step is safe to re-run. pickld.me's DNS is on Cloudflare, so the Workers serve `pickld.me`, `www.pickld.me` and `photos.pickld.me` as custom domains.

**Photos stay in Checking in production** until `OPENAI_API_KEY` and an approved child-safety matcher are configured: `fn:moderate` refuses auto-approve and the hash-list stand-in when `APP_ENV=production` (`supabase/functions/moderate/config.ts`).

## Setup, in order (founders)

Never paste a key into a chat, an issue or the repo; each one goes straight into the dashboard or GitHub page named.

### 1. Supabase

1. supabase.com/dashboard → New project `pickld-production`, region Southeast Asia (Singapore). Generate the database password and keep it in the password manager. The Free plan has no backups (`backup-restore.md`).
2. supabase.com/dashboard/account/tokens → Generate new token `github-pickld-production`.
3. GitHub → Settings → Environments → `production`: variable `SUPABASE_PROJECT_REF` (Project Settings → General → Project ID), secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.

### 2. Mailer (Resend)

1. resend.com → sign up with the founders' shared address.
2. Domains → Add `mail.pickld.me`, region Tokyo (ap-northeast-1). Add the records it lists in Cloudflare → pickld.me → DNS → Records, each **DNS only** (grey cloud). Wait for Verified.
3. API Keys → Create `supabase-production`, Sending access, domain `mail.pickld.me`.
4. GitHub `production`: secret `RESEND_API_KEY`, variable `EMAIL_FROM` = `Pickld <hello@mail.pickld.me>`.

The next run sets Supabase Auth's SMTP (smtp.resend.com:465, user `resend`) and raises Auth's email limit to 60 an hour. Resend's free plan sends 100 emails a day.

### 3. Waitlist (Turnstile)

1. Cloudflare → Turnstile → Add widget `pickld.me waitlist`, hostnames `pickld.me` and `www.pickld.me`, mode Managed.
2. GitHub `production`: variable `TURNSTILE_SITE_KEY`, secret `TURNSTILE_SECRET_KEY`.
3. Secret `WAITLIST_SECRET`: a random value (`openssl rand -hex 32 | gh secret set WAITLIST_SECRET --env production`). It lets pickld.me's invite pages call `fn:invite`.
4. Run deploy-production and check the smoke test. Then set variable `WAITLIST_OPEN` = `true` and run it again.

### 4. Cloudflare (photos)

1. R2 → Create bucket `pickld-photos-production`, location Asia-Pacific, no public access (the first run also creates it if missing).
2. R2 → Manage API tokens → Create, Object Read & Write, only `pickld-photos-production`. GitHub `production`: secrets `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
3. My Profile → API Tokens → the token in `CLOUDFLARE_API_TOKEN`: it also needs Account · Workers R2 Storage · Edit (it already has Workers Scripts, Workers Routes and DNS for pickld.me).
4. Run deploy-production. `photos.pickld.me` starts answering a few minutes after the first run.

### Later

- Apple keys for Sign in with Apple revoke: `sign-in-with-apple.md` (variable `APPLE_SIGN_IN_KEY_ID`, variable `APPLE_TEAM_ID`, secret `APPLE_SIGN_IN_KEY` on `production`).
- `OPENAI_API_KEY`, `SENTRY_DSN`, `EXPO_ACCESS_TOKEN`, RevenueCat (`revenuecat.md`).
- A moderator and founder: `staging.md` step 6, plus `"founder": true` (`invite-period.md`).

## Check

- The workflow's smoke test: `fn:health` (or `fn:health/queue` before the R2 keys), the sticker and the 403 once photos are on, and the cron calls.
- Supabase → Authentication → Emails shows the Pickld templates; SMTP Settings shows Resend once step 2 is done.
- With the waitlist open: join on pickld.me with a real address, get the 6-digit code from `hello@mail.pickld.me`, and check `select count(*) from waitlist;` in the SQL editor.
