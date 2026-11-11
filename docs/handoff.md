# Handoff: Pickld 2.0 build, from the local Mac runner back to the Amp orb

Nov 11, 2026. Written by the Mac-runner thread (https://ampcode.com/threads/T-01a1c621-f9ab-7659-8d9a-cc67c1c7c781), which took over from the orb thread (https://ampcode.com/threads/T-01a1c5c5-3a07-75dc-bcc9-b5a2a41f7d1a) on Nov 10. jofftiquez asked to hand the work back to the orb thread. The earlier orb-to-Mac note is kept below where it still applies.

Start by reading `AGENTS.md`, then this file, then `docs/plan.md`, then `docs/decisions.md`. The original brief (four phases: Analyze, Plan, Create issues, Execute) still applies; Phases 1–3 are done.

## 1. Where things stand

- **Phases 1–3:** done (analysis, plan with 131 tasks, issues #1–#137). See `docs/analysis.md`, `docs/plan.md`, `docs/decisions.md`. Milestones: https://github.com/jofftiquez/pickld/milestones
- **Phase 4 (Execute):** M1 is in progress. The M1 report has **not** been posted, so M2 must not start.

### M1 per task

| Task | Issue | State |
| --- | --- | --- |
| M1-01 Vendor accounts | #1 | Open, founder task (no accounts exist yet) |
| M1-02 Expo scaffold | #2 | Merged, PR #138 |
| M1-03 Fonts, i18n, lint guards | #3 | Merged, PR #139 |
| M1-04 CI pipeline | #4 | Merged, PR #140 |
| M1-05 Local Supabase, seed, types | #5 | Merged, PR #141; ports moved to 5542x in PR #152 |
| M1-06 pgTAP harness | #6 | Merged, PR #142 |
| M1-07 Harden profiles (0002) | #7 | Merged, PR #144 |
| M1-08 Harden jars (0003) | #8 | Merged, PR #146 |
| M1-09 Harden moments (0004) | #9 | Merged, PR #147 |
| M1-10 Harden social (0005) | #10 | Merged, PR #149 |
| M1-11 Full RLS matrix | #11 | Merged, PR #153 (migration 0006 revokes anon; `007_rls_matrix.sql`, 345 tests) |
| M1-12 Auth providers 🔑 | #12 | **Blocked**: needs Apple Sign in key, Services ID, team ID and Google OAuth client IDs (M1-01) |
| M1-13 App Supabase client | #13 | Merged, PR #145 |
| M1-14 Photo worker 🔑 | #14 | Merged, PR #154 (`workers/photos/`, local stand-in is Supabase Storage's S3 bucket) |
| M1-15 fn: upload-url | #15 | Merged, PR #156 (also Sentry for Edge Functions, `pnpm fn:test`) |
| M1-16 fn: photo-urls | #16 | Merged, PR #157 (migration 0007 `moment_photo_paths`, `008_photo_paths.sql`) |
| M1-17 Sentry + PostHog wrapper 🔑 | #17 | Merged, PR #148. Live sending unverified (no keys). |
| M1-18 Buttons | #18 | Merged, PR #150 |
| M1-19 Form controls | #19 | Merged, PR #155 |
| M1-20 Containers | #20 | Merged, PR #159 |
| M1-21 JarGraphic | #21 | **WIP branch `m1-21-jar-graphic`**, pushed, no PR (§2) |
| M1-22 MomentTile, PhotoTile | #22 | Not started |
| M1-23 Tab bar and tab shell | #23 | Not started |
| M1-24 Dev gallery, screenshot tooling | #24 | **WIP branch `m1-24-dev-gallery`**, pushed, no PR (§2) |
| M1-25 App icon and splash | #25 | Merged, PR #143 |
| M1-26 Verify CSAM scanning 🔑 | #26 | Merged, PR #158 (`docs/csam-scanning.md`) |
| M1-27 Legal drafts | #27 | Open, founder task |
| M1-28 Staging/prod pipeline 🔑 | #28 | **Blocked**: needs Supabase staging/prod (Singapore), Cloudflare, Vercel and CI deploy secrets |

Issue checkboxes are ticked and the issues closed for every merged task above.

**Remaining order (app lane only; the backend lane is done except the two blocked tasks):**
M1-21 → M1-22 → M1-23 → M1-24 → M1 report (§4) → **stop and wait for jofftiquez's approval before M2.**

### Decisions to put in the M1 report (from M1-26 and the backend lane)

1. Approve applying for Microsoft PhotoDNA Cloud Service (free for vetted organizations, monthly transaction limit). Cloudflare's CSAM Scanning Tool has no API or webhook and only scans images in Cloudflare's cache, so it can't be the automatic gate FR-SAF-04 requires; `docs/csam-scanning.md` proposes a fail-closed hash check in `fn:moderate` with Cloudflare as a free backstop. Paid fallbacks (Thorn Safer, Hive) need his approval.
2. Name who reads Cloudflare's daily CSAM detection email, and confirm the tool is a backstop only.
3. Founder-owned settings still missing: R2 buckets and tokens, `PHOTO_TOKEN_SECRET`, `SENTRY_DSN`, the photos domain (e.g. photos.pickld.me).

Backend follow-ups (not M1 scope): signed-in users can still call `is_blocked_between`; owners can delete removed moments, which loses evidence (belongs with M3-23).

## 2. Open branches and what's left

No PRs are open. Two unfinished branches are pushed:

**`m1-21-jar-graphic`** (one commit on top of main at #159). `JarGraphic` in `apps/mobile/src/components/JarGraphic.tsx` draws the design's 48×60 jar with `react-native-svg`: lid color, 0–8 layers alternating `brand` / `brandLayer` from the bottom, clipped to the glass body, `onDark` variant, `decorative` option. It announces "n of 8 moments" (`jar.moments` in `en.json`). A newly added layer drops and settles over `motion.jarLayerSettle`; with Reduce Motion it fades in place over `motion.base`. New `jar` color tokens in `tokens.ts`. 20 Jest tests pass (counts 0–8, layer order and colors, sizes 14/22/52, lid color, Reduce Motion branch); typecheck and lint pass. Checked on the iOS Simulator with a temporary preview route (deleted): jars 0–8 show the right layer counts. What's left:
- Android check and captures (iOS and Android screenshots of the jar section)
- full `./scripts/ci.sh`, then the PR `M1-21: JarGraphic` with `Closes #21`, green `ci`, merge, tick #21, screenshots to the Space

**`m1-24-dev-gallery`** (based on main at #150; rebase onto main first). It contains `scripts/capture-design.mjs` (Playwright captures `design/screens/<Screen>.html` to `docs/milestones/<M>/<Screen>-design.png` at 3×, 1170×2532) and `playwright` as a root devDependency. Run `npx playwright install chromium` once. What's left:
- the `/dev/gallery` route (dev builds only) showing every kit component and state, including M1-21–M1-23
- Maestro flow(s) with `takeScreenshot` writing `<Screen>-ios.png` and `<Screen>-android.png`
- one command producing iOS, Android and design captures into `docs/milestones/M<n>/`

**M1-22** (issue #22, designs Main, UploadStates, Story): tile states filled, empty, Now, private, waiting, uploading, failed with Retry, checking, Added later; each reads as "#slot, time, state"; private shows a lock, failed shows a warning icon plus text.
**M1-23** (issue #23): floating tab bar with blur (Today, Capture, Jars, My days) and the tab shell.

### Lessons from M1-19 to M1-21

- NativeWind drops `Pressable` style functions; use `onPressIn`/`onPressOut` state with a plain style array.
- Real Reanimated fails under Jest. Tests mock it per file (see `Containers.test.tsx`, `JarGraphic.test.tsx`), plus a custom `@gorhom/bottom-sheet` mock.
- react-native-svg turns colors into `{ type: 0, payload: <ARGB> }`; compare with `processColor(...)` in tests.
- `_layout.tsx` calls `LogBox.ignoreAllLogs()` so the dev warning toast doesn't cover screens and screenshots.
- A new route file needs a Metro restart with `--clear`.
- Use a temporary preview route for on-device checks and delete it before committing.

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

**Merging (D-16 and D-21):** squash-merge your own PRs once the GitHub `ci` check is green (`gh pr merge N --squash --delete-branch`). Branch protection on `main` now requires the `ci` check (verified Nov 11 through the GitHub API).

**Decisions D-19 to D-21** (full text in `docs/decisions.md`):
- **D-19:** GitHub Actions was blocked by account billing, so `scripts/ci.sh` was run locally before merging. PRs #138–#148 were merged under this rule. **Superseded by D-21.**
- **D-20:** squash-merge without required checks while D-19 lasted. **Superseded by D-21.**
- **D-21:** the repo was made public on Nov 10 so Actions runs. `ci` is green on main (first run 42843763954, about 5 minutes). Every PR now waits for a green `ci` check. A history scan before relying on the public repo found no secrets. Branch protection and secret scanning with push protection still need enabling by a repo admin.

**Secrets (the repo is public).** Never commit a key, token, `.env` file or the Supabase CLI's local demo keys. Only `apps/mobile/.env.example` with empty values is tracked. Scan every diff for `eyJ`, `sk-`, `phc_`, `service_role`, `sb_secret` and `-----BEGIN` before pushing. Vendor keys go in Amp secrets or the runner's local env, never the repo.

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

M1 screenshots taken so far (all committed):
- `docs/screenshots/M1-03/`: placeholder Today, before and after fonts (iOS only)
- `docs/screenshots/M1-25/`: Splash design, native, overlay; AppIcon design, home screen (iOS only)
- `docs/screenshots/M1-20/`: containers base, sheet and dialog, iOS and Android

For the M1 report, recapture these into `docs/milestones/M1/` together with the component gallery (M1-24), adding Android where missing.

## 5. Environment notes

### Orb (where the work continues)

The orb has no Xcode or Android emulator. Start a Mac satellite (`mac_sidecar start`) for iOS builds and the Simulator. The Mac satellite can't run an Android emulator either (D-15), so Android captures for M1-21 onward and the M1 report can't be taken from the orb. Options: ask jofftiquez to run them on his Mac, or report them as missing in the M1 report. Do not skip the stop.

Toolchain used on the orb and Mac satellite: Node 26, pnpm 12 (`nodeLinker: hoisted`, `allowBuilds` in `pnpm-workspace.yaml`), Expo SDK 58 / React Native 0.88, Supabase CLI 3.1.0 as a root devDependency, Deno (now required: `pnpm fn:test` runs Edge Function tests and CI installs it), Maestro 2.12.1 with OpenJDK 17, Playwright Chromium, ImageMagick 7 (only for `apps/mobile/scripts/gen-brand-assets.sh`).

### Local Supabase ports (all machines)

PR #152 moved local Supabase to 55420–55429 so it doesn't clash with other local projects: API 55421, database 55422, Studio 55423, mail UI 55424. Use these in `.env` (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421`) and in `adb reverse tcp:55421 tcp:55421` for Android. On jofftiquez's Mac another project holds 54321–54329; never stop or touch it.

### What differed on jofftiquez's Mac (`macbook-pro-local`)

- Node 24 via nvm (`source ~/.nvm/nvm.sh && nvm use 24`), pnpm 12.0.0, Deno 2.9.5, Xcode 26.4.1, iPhone 17 Pro simulator. The project still builds on Node 24.
- Builds and Maestro need `LANG=en_US.UTF-8`, `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, `~/.maestro/bin` on `PATH`, `ANDROID_HOME=~/Library/Android/sdk`.
- `rg` isn't installed; use `git grep`.
- Android: AVD `Pixel_9_API_36` (`emulator-5554`). Maestro hangs on Android, so open routes with `adb shell am start -W -a android.intent.action.VIEW -d "pickld://<route>" me.pickld.app` and capture with `adb exec-out screencap -p`. Start the emulator in its own session (e.g. Python `subprocess.Popen(..., start_new_session=True)`); launched from a tool shell it is shut down when the command ends. `expo run:android` can time out under load; install the debug APK with `adb install -r` instead.
- `simctl openurl` raises an iOS "Open in Pickld?" prompt; open deep links through a Maestro flow (`openLink`), which taps Open.
- The Mac was heavily loaded (load average about 17, mostly Docker's VM). Under that load **every image upload from the Amp client timed out**, even a 17 KB file: `send_thread_message` `media_paths` and `view_media` both failed with "Asset upload request timed out". From then on, screenshots were committed and linked on GitHub instead of attached, and images were checked by pixel scans with Python/PIL. On the orb, attach screenshots to the Space as the rules require; if uploads fail there too, link committed files and say so.

### First run

```sh
pnpm install
pnpm db:start            # first run pulls Supabase images (several minutes)
pnpm db:reset            # applies migrations 0001–0007 and supabase/seed.sql
pnpm db:test             # pgTAP suite 001–008, all passing
pnpm fn:test             # Edge Function tests against local Supabase (needs Deno)
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_SUPABASE_ANON_KEY from `pnpm exec supabase status -o env`
./scripts/ci.sh          # same steps as the GitHub workflow
cd apps/mobile && npx expo run:ios   # and npx expo run:android where an emulator exists
```

- `ios/` and `android/` are generated and git-ignored. After adding a native module, run `npx expo prebuild --clean` then `run:ios`.
- If `expo run:ios` fails with "Simulator app did not open fast enough", start Metro (`npx expo start`) and run `xcrun simctl launch booted me.pickld.app`.
- Seed users: `dale`, `mika`, `aya`, `jun`, `lola` at `@pickld.test`, plus `mod@pickld.test` (moderator). Sign-in is by email link; read mail at http://127.0.0.1:55424. Dale has blocked Lola. `supabase/README.md` explains the pgTAP helpers.
- Run `pnpm db:reset` right before `pnpm db:test` if anything else might have touched the local stack.
- Sentry and PostHog stay off unless `EXPO_PUBLIC_APP_ENV` is `staging` or `production` and their keys are set.

## 6. Still needed from jofftiquez

- Secret scanning with push protection (Settings → Code security). Branch protection requiring `ci` is already on.
- Vendor accounts in M1-01 (#1) and keys: Supabase staging and prod (Singapore), Cloudflare (R2, Workers, CSAM tool), OpenAI, Expo/EAS, Sentry, PostHog, Vercel, Apple and Google developer accounts. These unblock M1-12 and M1-28. Until then 🔑 tasks are built against local stand-ins only.
- The three decisions in §1 (PhotoDNA, CSAM email owner, photo settings).
- Legal drafts (M1-27, #27).
