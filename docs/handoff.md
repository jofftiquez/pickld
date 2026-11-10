# Handoff: Pickld 2.0 build, from the Amp orb to the local Mac runner

Nov 10, 2026. Written by the Amp thread that ran Phases 1–4 so far (https://ampcode.com/threads/T-01a1c5c5-3a07-75dc-bcc9-b5a2a41f7d1a). The work continues on jofftiquez's Mac runner `macbook-pro-local`, repo at `~/Documents/workspace/personal/pickld`, where iOS and Android can both run.

Start by reading `AGENTS.md`, then this file, then `docs/plan.md`, then `docs/decisions.md`. The original brief (four phases: Analyze, Plan, Create issues, Execute) still applies; Phases 1–3 are done.

## 1. Where things stand

- **Phase 1 (Analyze):** done, approved with every default. See `docs/analysis.md` and `docs/decisions.md` D-1 to D-18.
- **Phase 2 (Plan):** done, approved. `docs/plan.md` has 131 tasks: M1 28, M2 31, M3 28, M4 22, M5 10, M6 12. `python3 scripts/check-plan.py .` re-verifies the dependency order and that every P0 requirement is mapped.
- **Phase 3 (Issues):** done. Issues #1–#137 are numbered in build order, with one "M<n> summary" issue per milestone (#29, #61, #90, #113, #124, #137). Issue numbers are written into `docs/plan.md`. Milestones: https://github.com/jofftiquez/pickld/milestones
- **Phase 4 (Execute):** M1 is in progress. Its milestone report has **not** been posted, so M2 must not start.

### M1 per task

| Task | Issue | State |
| --- | --- | --- |
| M1-01 Vendor accounts | #1 | Open, founder task (no accounts exist yet) |
| M1-02 Expo scaffold | #2 | Merged, PR #138 |
| M1-03 Fonts, i18n, lint guards | #3 | Merged, PR #139 |
| M1-04 CI pipeline | #4 | Merged, PR #140 |
| M1-05 Local Supabase, seed, types | #5 | Merged, PR #141 |
| M1-06 pgTAP harness | #6 | Merged, PR #142 |
| M1-07 Harden profiles (0002) | #7 | Merged, PR #144 |
| M1-08 Harden jars (0003) | #8 | Merged, PR #146 |
| M1-09 Harden moments (0004) | #9 | Merged, PR #147 |
| M1-10 Harden social (0005) | #10 | Merged, PR #149 |
| M1-11 Full RLS matrix | #11 | **Not started** (plan in §2) |
| M1-12 Auth providers 🔑 | #12 | Not started |
| M1-13 App Supabase client | #13 | Merged, PR #145 |
| M1-14 Photo worker 🔑 | #14 | Not started |
| M1-15 fn: upload-url | #15 | Not started |
| M1-16 fn: photo-urls | #16 | Not started |
| M1-17 Sentry + PostHog wrapper 🔑 | #17 | Merged, PR #148. Live sending unverified (no keys). Sentry in Edge Functions not built yet; do it with M1-15. |
| M1-18 Buttons | #18 | Merged, PR #150 |
| M1-19 Form controls | #19 | **WIP branch `m1-19-form-controls`** (§2) |
| M1-20 Containers | #20 | Not started |
| M1-21 JarGraphic | #21 | Not started |
| M1-22 MomentTile, PhotoTile | #22 | Not started |
| M1-23 Tab bar and tab shell | #23 | Not started |
| M1-24 Dev gallery, screenshot tooling | #24 | **WIP branch `m1-24-dev-gallery`** (§2) |
| M1-25 App icon and splash | #25 | Merged, PR #143 |
| M1-26 Verify CSAM scanning 🔑 | #26 | Not started (research and doc only) |
| M1-27 Legal drafts | #27 | Open, founder task |
| M1-28 Staging/prod pipeline 🔑 | #28 | Not started; needs M1-01 |

Issue checkboxes are ticked for M1-05 to M1-10, M1-13, M1-17 and M1-18. They are **not** ticked for M1-02, M1-03, M1-04 and M1-25 (the issues closed through "Closes #n"); tick them from those PRs' bodies.

Remaining order (dependencies allow two lanes in parallel, on different files):
- **Backend:** M1-11 → M1-12 → M1-14 → M1-15 → M1-16 → M1-26 → M1-28
- **App:** M1-19 → M1-20 → M1-21 → M1-22 → M1-23 → M1-24
- Then the M1 report (§4).

## 2. Open branches and what's left

No PRs are open. Two unfinished branches are pushed:

**`m1-19-form-controls`** (based on main at #150; no PR). It contains a `radius.input = 16` token, the `forms.characterCount` string in `en.json`, and `jest.setup.ts` loading the real `@/i18n` for tests. What's left:
- TextField with a counter (EditProfile design: 50 px tall, `border` color, radius 16, 12/600 muted label, 11 px counter)
- Toggle (48×28 track in `brand`; the off color #d5d9cf has no token yet, so add one; `role="switch"`)
- SegmentedControl (36 px tabs, pill on a `subtle` track, `tab` role with selected state)
- Chip (42 px; selected is ink with white text, unselected is white with a border; selected state announced)
- ListRow (12 px vertical padding, 15/600, chevron, optional value, danger tone)
- Tests for each, a check that layout holds at 200% text, then a PR, a green `ci` check and a merge.

**`m1-24-dev-gallery`** (based on main at #150; no PR). It contains `scripts/capture-design.mjs` (Playwright captures `design/screens/<Screen>.html` to `docs/milestones/<M>/<Screen>-design.png` at 3×, 1170×2532, which matches the iOS Simulator's iPhone 17 Pro) and `playwright` as a root devDependency. Run `npx playwright install chromium` once. What's left:
- the `/dev/gallery` route (dev builds only) showing every kit component and state
- Maestro flow(s) with `takeScreenshot` writing `<Screen>-ios.png` and `<Screen>-android.png`
- one command producing iOS, Android and design captures into `docs/milestones/M<n>/`

**M1-11 plan** (from the backend lane, nothing written yet):
1. New migration `0006`: anon can still read every `follows` row (6 on the seed data). It's the only public table anon can read rows from. Revoke anon's table grants on `public` plus default privileges; the web uses narrow `security definer` RPCs later (decision C-6).
2. `supabase/tests/007_rls_matrix.sql`: a `tests.can_see(kind, a, b)` helper that runs as the caller and treats a permission error as "not visible", plus a table of objects with who should see each.
   - Objects: jars (unpublished, readers, everyone, only_me, suspended owner); moments (live, private, checking, removed, and live inside each jar state); comments (visible, hidden, deleted, by a blocked user); reactions; follows; blocks; profiles; a moderation item; a report; a notification.
   - Roles: owner, reader, outsider, blocked, blocker, moderator, anon. One `is()` per object and role pair.

Also noted by the backend lane, for later tasks:
- Owners can delete a removed moment, and `moderation_items` cascades on delete, so strike evidence (D-10) can disappear. Handle this in the strikes task (M3-23).
- 0002 also revoked TRUNCATE, REFERENCES and TRIGGER from client roles, because Supabase's defaults let TRUNCATE bypass RLS and the audit log's append-only trigger.

## 3. Rules still in force

**Overnight goal.** jofftiquez's standing instruction: keep working until all phases are done, without waiting for check-ins, except at the approval stops below.

**Approval stops (from the brief; do not skip):**
- At the end of **every milestone** (M1 to M6): post the milestone report (§4), then **wait for jofftiquez's reply** before starting the next milestone. If he points out a difference, open an issue for it in the current milestone and fix it first.
- **Always ask before you:**
  - change the schema in a way that drops or renames existing columns
  - add a new paid service or dependency not listed in `AGENTS.md`
  - change a product rule in `docs/product.md` or a requirement's acceptance criteria
  - skip or reorder a P0 task

**Per issue (brief, Phase 4):**
1. Branch `<task-id>-<slug>`.
2. Implement exactly the issue scope.
3. Tests: unit tests for logic, pgTAP for every RLS or schema change (owner, reader, outsider, blocked user), Maestro when a user flow completes.
4. Typecheck, lint and tests must pass.
5. PR titled `<TASK-ID>: <title>` with `Closes #n`, the FR/NFR IDs, and how each acceptance criterion was verified. Before/after screenshots if a screen changes.
6. Tick the issue checklist.
7. Post a one-line status when starting and finishing each issue.

**Merging (D-16 and D-21):** squash-merge your own PRs once the GitHub `ci` check is green. Branch protection is **not** enabled, because the agent token lacked admin rights. The rule is enforced by process until jofftiquez enables "require `ci`" on `main`.

**Decisions D-19 to D-21** (full text in `docs/decisions.md`):
- **D-19:** GitHub Actions was blocked by account billing, so `scripts/ci.sh` was run locally before merging. PRs #138–#148 were merged under this rule. **Superseded by D-21.**
- **D-20:** squash-merge without required checks while D-19 lasted. **Superseded by D-21.**
- **D-21:** the repo was made public on Nov 10 so Actions runs. `ci` is green on main (first run 42843763954, about 5 minutes). Every PR now waits for a green `ci` check. A history scan before relying on the public repo found no secrets. Branch protection and secret scanning with push protection still need enabling by a repo admin.

**Secrets (the repo is public).** Never commit a key, token, `.env` file or the Supabase CLI's local demo keys. Only `apps/mobile/.env.example` with empty values is tracked. Scan every diff for `eyJ`, `sk-`, `phc_`, `service_role` and `-----BEGIN` before pushing. Vendor keys go in Amp secrets or the runner's local env, never the repo.

**Screenshots go to the Space.** jofftiquez asked that screenshots be sent to the main Space thread (`T-01a1c5b7-2fb4-7704-897c-7a6b6d57c9b6`), not only shown in the working thread or on GitHub. Attach them with `send_thread_message` and `media_paths` for:
- every PR that changes how a screen looks (before and after), when the PR is opened
- every milestone report, grouped by screen with the design next to the build

Also put them in the PR description, the milestone summary issue and the milestone's last PR.

## 4. Milestone report format (brief)

At the end of each milestone, before starting the next:
1. Capture every new or changed screen:
   - **iOS:** `xcrun simctl io booted screenshot <file>.png`, or Maestro `takeScreenshot`
   - **Android:** `adb exec-out screencap -p > <file>.png`. This is now possible on the runner; the orb couldn't run an emulator (D-15), so M1-02/03/25 have no Android captures yet.
   - **Design:** `node scripts/capture-design.mjs M<n> <Screen> …`
   - **Web:** Playwright at 390 px (shared-link page) and 1280 px (moderation console)
   - Use the realistic seed data so screens look like the designs.
2. Save them to `docs/milestones/M<n>/` as `<Screen>-ios.png`, `<Screen>-android.png` and `<Screen>-design.png`.
3. Post the report to the Space thread with the images attached. For each screen, add one line on any visible difference from the design and whether it's intended. Then: what shipped, which requirement IDs are now satisfied, what slipped and why, and the next milestone's first three issues.
4. Attach the same screenshots to the summary issue (#29 for M1) and to the milestone's last PR.
5. Wait for jofftiquez's reply.

M1 screenshots taken so far (iOS only), already posted to the Space:
- `docs/screenshots/M1-03/`: placeholder Today, before and after fonts
- `docs/screenshots/M1-25/`: Splash design, native, overlay; AppIcon design, home screen

For the M1 report, recapture these into `docs/milestones/M1/` together with the component gallery, adding Android.

## 5. Things that lived only on the orb (recreate on the runner)

**Toolchain used on the orb and Mac satellite:**
- Node 26, pnpm 12. pnpm uses `nodeLinker: hoisted`, which Expo needs; packages whose build scripts are skipped are listed under `allowBuilds` in `pnpm-workspace.yaml`.
- Expo SDK 58 / React Native 0.88, built with Xcode 27.2 on an iPhone 17 Pro simulator.
- Docker, needed for local Supabase. On the orb it ran as a supervised service; on the Mac use Docker Desktop or OrbStack.
- Supabase CLI 3.1.0 as a root devDependency (`pnpm exec supabase`).
- Deno: not installed yet; Edge Function tasks need it (`curl -fsSL https://deno.land/install.sh | sh`).
- Maestro 2.12.1 with OpenJDK 17 (Homebrew `openjdk@17`). On the Mac satellite this needed `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` and `~/.maestro/bin` on `PATH`.
- Playwright Chromium (`npx playwright install chromium`).
- ImageMagick 7 (`magick`), only for `apps/mobile/scripts/gen-brand-assets.sh`.

**First run on the runner:**
```sh
pnpm install
pnpm db:start            # first run pulls Supabase images (several minutes)
pnpm db:reset            # applies migrations 0001–0005 and supabase/seed.sql
pnpm db:test             # 218 pgTAP tests, all passing at handoff
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_SUPABASE_ANON_KEY from `pnpm exec supabase status -o env`
./scripts/ci.sh          # same steps as the GitHub workflow
cd apps/mobile && npx expo run:ios   # and npx expo run:android
```

Notes on the iOS build:
- `ios/` and `android/` are generated and git-ignored.
- After adding a native module, rebuild: `npx expo prebuild --clean` then `run:ios`.
- On the orb, `expo run:ios` sometimes failed with "Simulator app did not open fast enough". Starting Metro (`npx expo start`) and running `xcrun simctl launch booted me.pickld.app` worked.

**Seed data:**
- Users: `dale`, `mika`, `aya`, `jun` and `lola` at `@pickld.test`, plus `mod@pickld.test` (username `pickld.mod`, moderator role).
- Sign-in is by email link; read the emails in the local mail UI at http://127.0.0.1:54324.
- Dale has blocked Lola. The seed includes full and partial jars, a private moment and a backfilled moment.
- `supabase/README.md` explains the pgTAP helpers (`tests.world()`, `tests.act_as()`, `make_jar`, `make_moment`).

**Other notes:**
- Run `pnpm db:reset` right before `pnpm db:test` if anything else might have touched the local stack.
- **Analytics and crash reporting:** Sentry and PostHog stay off unless `EXPO_PUBLIC_APP_ENV` is `staging` or `production` and their keys are set. The `@sentry/react-native/expo` plugin (source-map upload) is not added yet; it needs the Sentry org, project and auth token.
- **Nothing else needed from the orb:** the issue-creation scripts were one-offs (issue numbers are already in `docs/plan.md`). The plan checker is committed as `scripts/check-plan.py`.

## 6. Still needed from jofftiquez

- Enable branch protection on `main` (require the `ci` check), and secret scanning with push protection (Settings → Code security).
- Create the vendor accounts in M1-01 (#1) and add keys locally or as secrets: Supabase staging and prod (Singapore), Cloudflare (R2, Workers, CSAM tool), OpenAI, Expo/EAS, Sentry, PostHog, Vercel, Apple and Google developer accounts. Until then 🔑 tasks are built against local stand-ins only.
- Legal drafts (M1-27, #27).
