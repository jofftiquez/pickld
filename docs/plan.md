# Pickld 2.0 — Implementation plan

Nov 10, 2026. Built from `docs/requirements.md`, `docs/architecture.md`, `docs/product.md`, `docs/analysis.md` and `docs/decisions.md`. Replaces the draft order in `docs/tasks.md` (the T-ids there map to tasks below).

## Rules this plan follows

- Tasks are ordered so that nothing starts before its dependencies. Security rules, the data model and the offline queue land before the screens that rely on them.
- Each task is half a day to a day of work, roughly under 400 changed lines. **S** ≈ half a day, **M** ≈ a day, **L** ≈ a day and over 300 lines (review carefully; split further if a PR goes past 400 lines).
- Areas: **app** (Expo), **backend** (Postgres, RLS, Edge Functions, infra), **web** (`apps/web`, `apps/mod`), **design** (content and human-owned work: founders, legal, research).
- M1–M5 tasks are P0; M6 tasks are P1.
- Screen names in **Design** are files in `design/screens/`. "No design" means the screen is built from the component kit following the nearest design (analysis G-15).
- **Credentials:** tasks marked 🔑 need a vendor account (D-14). They're built and tested against local stand-ins first; the live step is reported as blocked until the founders add keys.
- Every task's Definition of Done is the one in `AGENTS.md`: typecheck, lint and tests pass; RLS changes have pgTAP tests covering owner, reader, outsider and blocked user; no hard-coded colors or strings; accessibility labels present.

## Milestones

GitHub: [milestones](https://github.com/jofftiquez/pickld/milestones). Issues #1–#137 are numbered in build order.

| Milestone | Weeks | Tasks |
| --- | --- | --- |
| M1 Foundations | 1–2 | 28 (summary #29) |
| M2 Core loop | 3–6 | 31 (summary #61) |
| M3 Social & safety | 7–8 | 28 (summary #90) |
| M4 Onboarding & sharing | 9–10 | 22 (summary #113) |
| M5 Beta & launch | 11–12 | 10 (summary #124) |
| M6 Post-launch (P1) | after launch | 12 (summary #137) |
| **Total** | | **131** |

---

## M1 Foundations (weeks 1–2)

### M1-01 · Vendor accounts and paperwork
- **Area:** design · **Priority:** P0 · **Size:** M · **Requirements:** — · **Depends on:** — · **Issue:** #1
- **Goal:** Founders open every vendor account and start the agreements that take time (T-007, D-14).
- **Acceptance:**
  - [ ] Supabase staging and production projects in Singapore exist.
  - [ ] Cloudflare account with R2, Workers and the CSAM Scanning Tool requested.
  - [ ] OpenAI account and data processing agreement started.
  - [ ] Apple Developer, Google Play Console, Expo/EAS, Sentry, PostHog and Vercel accounts exist.
  - [ ] Keys are stored as Amp secrets (never in the repo).
- **Tests:** Checklist reviewed by the product owner.
- **Screenshots:** —
- **Design:** —

### M1-02 · Monorepo and Expo app scaffold
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-A11Y-04 · **Depends on:** — · **Issue:** #2
- **Goal:** pnpm workspace with `apps/mobile` (Expo, Expo Router, TypeScript strict) and NativeWind themed from `src/theme/tokens.ts` (T-001).
- **Acceptance:**
  - [ ] `pnpm install` and `pnpm -w typecheck` pass; `strict` and `noUncheckedIndexedAccess` on.
  - [ ] NativeWind theme colors, radii and spacing come only from `tokens.ts`.
  - [ ] App boots to a placeholder Today route on the iOS Simulator.
  - [ ] ESLint and Prettier configured; Jest runs.
- **Tests:** Jest smoke test for the theme mapping; typecheck; iOS Simulator boot.
- **Screenshots:** —
- **Design:** —

### M1-03 · Fonts, translations and lint guards
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** NFR-I18N-01, NFR-A11Y-04 · **Depends on:** M1-02 · **Issue:** #3
- **Goal:** Plus Jakarta Sans 400–800 loaded, all copy in `src/i18n/en.json`, locale-aware date and time formatting, lint rules against inline strings and hex colors.
- **Acceptance:**
  - [ ] `t('…')` helper typed against `en.json` keys.
  - [ ] Date and time helpers follow the phone's locale.
  - [ ] Lint fails on raw JSX strings and on hex or rgb color literals outside `tokens.ts`.
  - [ ] Adding a locale file needs no code change.
- **Tests:** Unit tests for the formatters (en-US, fil-PH); lint test fixtures.
- **Screenshots:** —
- **Design:** —

### M1-04 · CI pipeline
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-SEC-01 · **Depends on:** M1-02 · **Issue:** #4
- **Goal:** GitHub Actions run typecheck, lint, unit tests and, once Supabase exists, the pgTAP suite on every PR.
- **Acceptance:**
  - [ ] PRs show a required "ci" check.
  - [ ] The workflow caches pnpm and runs in under 10 minutes.
- **Tests:** CI green on the PR itself.
- **Screenshots:** —
- **Design:** —

### M1-05 · Local Supabase, seed data and generated types
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** NFR-SEC-01 · **Depends on:** M1-04 · **Issue:** #5
- **Goal:** `supabase/` config, `0001_init.sql` applied locally and in CI, realistic seed users and jars, `src/lib/database.types.ts` generated (T-003, local part).
- **Acceptance:**
  - [ ] `supabase db reset` applies all migrations cleanly.
  - [ ] Seed has several users, full and partial jars, a private moment and a backfilled moment.
  - [ ] Types regenerate with one script; CI fails if they're stale.
- **Tests:** CI runs `supabase db reset`; type-staleness check.
- **Screenshots:** —
- **Design:** —

### M1-06 · pgTAP harness and baseline visibility tests
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-PUB-02, NFR-SEC-01 · **Depends on:** M1-05 · **Issue:** #6
- **Goal:** Test helpers that create users and act as owner, reader, outsider, blocked user and moderator; first tests for unpublished jars (T-004).
- **Acceptance:**
  - [ ] `supabase test db` runs in CI.
  - [ ] Helpers set JWT claims for each role.
  - [ ] An unpublished jar and its moments are invisible to everyone but the owner.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M1-07 · Harden profiles (0002)
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-ACC-05, FR-PUB-06, FR-SAF-06, NFR-SEC-01 · **Depends on:** M1-06 · **Issue:** #7
- **Goal:** Fix S-1, S-4, S-13: profile column guard, real birthday privacy, `my_profile()` RPC, `is_active_user()`, notifications update limited to `read_at`.
- **Acceptance:**
  - [ ] Owner can't change `status`, counts or `created_at`.
  - [ ] No user, including the owner, can select `birthday` directly; the owner gets it from `my_profile()`.
  - [ ] Blocked users can't read each other's profile.
  - [ ] Users can only set `read_at` on their own notifications.
- **Tests:** pgTAP as owner, other user, blocked user.
- **Screenshots:** —
- **Design:** —

### M1-08 · Harden jars and add travel fields (0003)
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-04, FR-JAR-05, FR-JAR-06, FR-JAR-08 · **Depends on:** M1-06 · **Issue:** #8
- **Goal:** Fix S-5 and S-9; add server-set `jars.ends_at` (D-1) and `visible_count` (D-9).
- **Acceptance:**
  - [ ] Owners can update only `visibility` and `published_at`.
  - [ ] `tz` must be a valid IANA name; future `local_date` for the zone is refused.
  - [ ] `ends_at` defaults to the next local midnight in `tz` and can only move later.
  - [ ] `visible_count` counts live, non-private moments; `moment_count` counts all non-removed.
- **Tests:** pgTAP, including DST zones and an invalid zone.
- **Screenshots:** —
- **Design:** —

### M1-09 · Harden moments (0004)
- **Area:** backend · **Priority:** P0 · **Size:** L · **Requirements:** FR-JAR-03, FR-JAR-06, FR-PUB-07, FR-CAP-10, NFR-SEC-01 · **Depends on:** M1-08 · **Issue:** #9
- **Goal:** Fix S-2: status transitions only from the server, photo or caption edits go through `pending_*` columns and re-check, `jar_id` locked, slot moves only to an empty slot, counts and backfill re-synced (G-12).
- **Acceptance:**
  - [ ] A second moment in a filled slot is refused.
  - [ ] Owner can't set `live`/`removed` or move a removed moment back to `checking`.
  - [ ] Changing photo or caption on a live moment writes `pending_*` and leaves the live version visible.
  - [ ] Moving to an empty slot in the same jar works; moving to another jar is refused.
  - [ ] `is_backfilled` uses `ends_at` and server time.
- **Tests:** pgTAP for each rule as owner and other user.
- **Screenshots:** —
- **Design:** —

### M1-10 · Harden social tables (0005)
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-05, FR-SOC-06, FR-PUB-06, FR-SAF-06, NFR-SEC-01 · **Depends on:** M1-07, M1-08 · **Issue:** #10
- **Goal:** Fix S-3, S-7, S-8, S-10 and the counter part of S-6: `delete_comment()` RPC, no direct comment updates, reactions only on visible targets, one reply level, active users only, like and comment counters.
- **Acceptance:**
  - [ ] A comment author can't unhide or edit a comment; author or jar owner can soft-delete via RPC.
  - [ ] Liking a jar you can't see is refused.
  - [ ] Replies to replies and cross-jar parents are refused.
  - [ ] Suspended or deleted users can't insert moments, comments, follows or reactions.
  - [ ] `like_count` and `comment_count` stay correct on insert and delete.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M1-11 · Full RLS matrix test suite
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-PUB-02, FR-PUB-03, FR-PUB-05, FR-PUB-06, FR-PUB-07, NFR-SEC-01 · **Depends on:** M1-09, M1-10 · **Issue:** #11
- **Goal:** One table-driven pgTAP suite covering jars, moments, comments, reactions, follows, blocks and profiles for every visibility state against every role.
- **Acceptance:**
  - [ ] States covered: unpublished, readers, everyone, only_me, private moment, checking, removed, suspended owner.
  - [ ] Roles covered: owner, reader, outsider, blocked (both directions), moderator.
  - [ ] CI fails on any leak.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M1-12 · Auth providers configuration 🔑
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-ACC-01, FR-ACC-02 · **Depends on:** M1-05 · **Issue:** #12
- **Goal:** Apple, Google and email-link providers configured per environment; redirect URLs and the `pickld://` scheme allowed (T-005, backend part).
- **Acceptance:**
  - [ ] Email links work locally (Inbucket) with no password fields anywhere.
  - [ ] Apple and Google configs are present and filled from secrets in staging and production.
- **Tests:** Local email-link sign-in script.
- **Screenshots:** —
- **Design:** —

### M1-13 · App Supabase client, session and query cache
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ACC-02, NFR-SEC-02, NFR-OFF-03 · **Depends on:** M1-03, M1-05 · **Issue:** #13
- **Goal:** `lib/supabase` with SecureStore sessions and Zod-validated env (anon key only), TanStack Query with an SQLite persister, and an auth state store.
- **Acceptance:**
  - [ ] Only the anon key is bundled; a test fails if a service key pattern appears in the app bundle.
  - [ ] Session survives restarts.
  - [ ] Cached queries are readable offline after a restart.
- **Tests:** Unit tests for env validation and the persister; bundle secret scan in CI.
- **Screenshots:** —
- **Design:** —

### M1-14 · Photo storage and token-checking worker 🔑
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** NFR-SEC-02 · **Depends on:** M1-04 · **Issue:** #14
- **Goal:** R2 buckets per environment (local S3-compatible bucket in dev), and a Cloudflare Worker that serves photos only with a valid short-lived HMAC token (D-12, T-006).
- **Acceptance:**
  - [ ] Requests without a valid, unexpired token get 403.
  - [ ] Objects are never overwritten (new key per upload).
  - [ ] Thumbnail and full sizes are both served.
- **Tests:** Worker unit tests (valid, expired, tampered tokens).
- **Screenshots:** —
- **Design:** —

### M1-15 · Edge Function: upload-url
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** NFR-SEC-02, FR-ACC-05, FR-JAR-03 · **Depends on:** M1-09, M1-14 · **Issue:** #15
- **Goal:** `fn:upload-url` validates input with Zod and returns signed PUT URLs for a moment's photo and thumbnail, or an avatar or cover.
- **Acceptance:**
  - [ ] Refuses jars the caller doesn't own and suspended users.
  - [ ] URLs expire within 10 minutes and are limited to the expected content type and size.
  - [ ] Returns `{ data } | { error }`.
- **Tests:** Deno tests for validation, ownership and expiry.
- **Screenshots:** —
- **Design:** —

### M1-16 · Edge Function: photo-urls
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-SEC-02, FR-PUB-05, FR-MOD-03 · **Depends on:** M1-11, M1-14 · **Issue:** #16
- **Goal:** `fn:photo-urls` issues batches of photo tokens only for moments the caller can view (moderators can view queued items).
- **Acceptance:**
  - [ ] A private, checking or removed moment never gets a token for anyone but the owner (and moderators for queued items).
  - [ ] Tokens last 15 minutes.
- **Tests:** Deno tests against local Supabase with the RLS fixtures.
- **Screenshots:** —
- **Design:** —

### M1-17 · Monitoring and analytics wrapper 🔑
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** NFR-REL-01, NFR-ANL-01, FR-PUB-05 · **Depends on:** M1-03 · **Issue:** #17
- **Goal:** Sentry in the app and Edge Functions; a typed PostHog wrapper whose event allowlist rejects photo, caption and private-moment data (G-19).
- **Acceptance:**
  - [ ] Crashes reach Sentry (staging) and are no-ops locally.
  - [ ] Events with disallowed properties fail typecheck and are dropped at runtime.
- **Tests:** Unit tests for the allowlist.
- **Screenshots:** —
- **Design:** —

### M1-18 · Component kit: buttons
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-A11Y-01, NFR-A11Y-03, NFR-A11Y-04 · **Depends on:** M1-03 · **Issue:** #18
- **Goal:** PrimaryButton, SecondaryButton, DangerButton, PillButton and RoundIconButton (light, glass) (T-002).
- **Acceptance:**
  - [ ] Primary is `#7fad33` with bold white text ≥ 14 px; other text passes AA.
  - [ ] Every button has `accessibilityLabel` and a ≥ 44 × 44 tap area via `hitSlop`.
  - [ ] Pressed and disabled states; disabled is announced.
- **Tests:** Jest render tests for labels, hit areas and disabled state.
- **Screenshots:** Gallery (buttons section).
- **Design:** Settings, Publish, Welcome

### M1-19 · Component kit: form controls
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-A11Y-01, NFR-A11Y-03 · **Depends on:** M1-18 · **Issue:** #19
- **Goal:** TextField (with counter), Toggle, SegmentedControl, Chip and ListRow.
- **Acceptance:**
  - [ ] Each control has an accessible role, label and state.
  - [ ] Layout holds at 200% text.
- **Tests:** Jest render tests.
- **Screenshots:** Gallery (forms section).
- **Design:** Settings, EditProfile, QuizPeople

### M1-20 · Component kit: containers
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-A11Y-01, NFR-A11Y-02 · **Depends on:** M1-18 · **Issue:** #20
- **Goal:** Card, Avatar, BottomSheet (`@gorhom/bottom-sheet`) and Dialog.
- **Acceptance:**
  - [ ] Sheets and dialogs trap focus for screen readers and close with an accessible button.
  - [ ] Reduce Motion shortens sheet animations.
- **Tests:** Jest render tests.
- **Screenshots:** Gallery (containers section).
- **Design:** Report, Block, MomentOptions

### M1-21 · Component kit: JarGraphic
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-01, FR-JAR-07, FR-ONB-04, NFR-A11Y-02 · **Depends on:** M1-18 · **Issue:** #21
- **Goal:** Glass jar with lid color, 0–8 layers alternating brand and brandLayer, settle animation per added layer.
- **Acceptance:**
  - [ ] Renders at 14, 22 and 52 px.
  - [ ] Announces "n of 8 moments".
  - [ ] Reduce Motion replaces the settle animation with a fade.
- **Tests:** Jest render tests per count; Reduce Motion branch.
- **Screenshots:** Gallery (jar section).
- **Design:** Main, JarLid, FullJar

### M1-22 · Component kit: MomentTile and PhotoTile
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-02, FR-JAR-06, NFR-A11Y-01 · **Depends on:** M1-21 · **Issue:** #22
- **Goal:** MomentTile states: filled, empty, Now, private, waiting, uploading, failed with Retry, checking, Added later; PhotoTile with bottom fade and label.
- **Acceptance:**
  - [ ] Each state reads as "#slot, time, state".
  - [ ] Private shows a lock and failed shows a warning icon and text (not color alone).
- **Tests:** Jest render tests for every state.
- **Screenshots:** Gallery (tiles section).
- **Design:** Main, UploadStates, Story

### M1-23 · Floating tab bar and tab shell
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** NFR-A11Y-01, NFR-A11Y-03 · **Depends on:** M1-20 · **Issue:** #23
- **Goal:** Custom Expo Router tab bar with blur: Today, Capture, Jars, My days.
- **Acceptance:**
  - [ ] Selected tab announced; tap areas ≥ 44.
  - [ ] Matches the tab bar on Main.
- **Tests:** Jest render test; Maestro tab switch.
- **Screenshots:** Today placeholder with tab bar.
- **Design:** Main

### M1-24 · Dev gallery and screenshot tooling
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-A11Y-01 · **Depends on:** M1-19, M1-22, M1-23 · **Issue:** #24
- **Goal:** `/dev/gallery` shows every kit state; scripts capture iOS Simulator screens (Maestro `takeScreenshot`) and design screens (Playwright) into `docs/milestones/M<n>/`.
- **Acceptance:**
  - [ ] Gallery reachable only in dev builds.
  - [ ] One command produces `<Screen>-ios.png` and `<Screen>-design.png`.
- **Tests:** Maestro gallery flow.
- **Screenshots:** Gallery.
- **Design:** —

### M1-25 · App icon and splash screen
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** — · **Depends on:** M1-03 · **Issue:** #25
- **Goal:** Classic mark icon (1024 iOS master, Android adaptive and monochrome) and the Splash design from `assets/` (T-008, asset part).
- **Acceptance:**
  - [ ] Icon has no transparency on iOS; mark inside the 66% safe zone.
  - [ ] Splash is #7fad33 with the white mark and wordmark.
- **Tests:** Visual check on the iOS Simulator.
- **Screenshots:** Splash, AppIcon.
- **Design:** Splash, AppIcon

### M1-26 · Verify CSAM scanning integration 🔑
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-SAF-04 · **Depends on:** M1-14 · **Issue:** #26
- **Goal:** Confirm how Cloudflare's CSAM Scanning Tool reports a match and write down how `fn:moderate` gates on it (analysis risk).
- **Acceptance:**
  - [ ] A short doc in `docs/` states the detection signal, its latency and the fallback.
  - [ ] If no programmatic signal exists, the product owner gets a vendor recommendation (needs approval).
- **Tests:** —
- **Screenshots:** —
- **Design:** —

### M1-27 · Legal page drafts
- **Area:** design · **Priority:** P0 · **Size:** M · **Requirements:** FR-PRV-04 · **Depends on:** — · **Issue:** #27
- **Goal:** Founders and a lawyer draft Terms, Privacy Policy and Community Guidelines (T-008, legal part).
- **Acceptance:**
  - [ ] Drafts exist as Markdown in `apps/web/content/legal/`.
  - [ ] Lawyer review requested.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

### M1-28 · Staging and production pipeline, backups 🔑
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-REL-02 · **Depends on:** M1-04, M1-01 · **Issue:** #28
- **Goal:** CI applies migrations to staging on merge and to production on release tags; daily backups on.
- **Acceptance:**
  - [ ] A merge deploys migrations and functions to staging.
  - [ ] Production deploy needs a tag.
  - [ ] Daily backups enabled on both.
- **Tests:** Dry run against staging.
- **Screenshots:** —
- **Design:** —

---

## M2 Core loop (weeks 3–6)

### M2-01 · Jar logic library
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-02, FR-JAR-04, FR-JAR-05 · **Depends on:** M1-03 · **Issue:** #30
- **Goal:** `src/lib/jars.ts`: local date in a zone, current slot, open-jar lookup, travel rule including the westward collision (D-1), server-time offset (T-101).
- **Acceptance:**
  - [ ] Now windows: morning 05:00–11:59, afternoon 12:00–17:59, evening 18:00–23:59; none 00:00–04:59.
  - [ ] An open jar finishes in its own zone.
  - [ ] Westward collisions resolve to the same-date jar.
- **Tests:** Table-driven unit tests: midnight, DST both ways, date line, Manila→London, Manila→Tokyo.
- **Screenshots:** —
- **Design:** —

### M2-02 · ensure_jar RPC
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-JAR-04, FR-JAR-05 · **Depends on:** M1-08 · **Issue:** #31
- **Goal:** `ensure_jar(local_date, tz)` upserts today's jar and handles re-zoning (D-1) with server-side date checks.
- **Acceptance:**
  - [ ] Concurrent calls from two devices return the same jar.
  - [ ] Future dates refused; collisions extend `ends_at` only forward.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M2-03 · Offline queue core
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-OFF-01, NFR-OFF-02 · **Depends on:** M1-13 · **Issue:** #32
- **Goal:** expo-sqlite queue table, photo copied into app storage before anything else, upload state machine with backoff 1 s, 5 s, 30 s, 2 m, 10 m (T-103).
- **Acceptance:**
  - [ ] A queued moment survives restarts and deletion of the gallery original.
  - [ ] After 5 failed attempts the state is failed and Retry resets it.
- **Tests:** Unit tests for the state machine and backoff with fake timers.
- **Screenshots:** —
- **Design:** —

### M2-04 · Upload worker
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-OFF-01, NFR-OFF-02, FR-JAR-03 · **Depends on:** M2-03, M1-15, M2-02 · **Issue:** #33
- **Goal:** queue → `fn:upload-url` → PUT photo and thumbnail → insert moment (`checking`); resumes on reconnect and app open; iOS background upload session.
- **Acceptance:**
  - [ ] Coming back online uploads queued moments automatically.
  - [ ] A slot conflict surfaces as a Replace choice, not a failure.
- **Tests:** Unit tests with a mocked network; integration test against local Supabase.
- **Screenshots:** —
- **Design:** —

### M2-05 · Today screen
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-01, FR-JAR-02 · **Depends on:** M1-23, M2-01, M1-13 · **Issue:** #34
- **Goal:** Header (date, greeting), dark jar card (JarGraphic, "n of 8 moments", reader count, Publish), 2-column grid of 8 slots in fixed order with the Now tile; first-day state (T-102).
- **Acceptance:**
  - [ ] Grid merges server moments with queued ones.
  - [ ] Only the current slot shows "Now · Tap to capture".
  - [ ] First-day state shows "Your first jar…".
- **Tests:** Jest tests for the grid model; Maestro screenshot flow.
- **Screenshots:** Today, Today first day.
- **Design:** Main, EmptyToday

### M2-06 · Today: midnight rollover and upload states
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-04, NFR-OFF-01, NFR-OFF-03 · **Depends on:** M2-05, M2-04 · **Issue:** #35
- **Goal:** Switch to a new jar at local midnight without restart; offline banner; waiting, uploading and failed tile states; cached Today offline.
- **Acceptance:**
  - [ ] At 00:00 Today shows an empty jar; yesterday's is in My days.
  - [ ] Offline banner counts saved moments.
- **Tests:** Unit test for the midnight timer; Maestro offline flow.
- **Screenshots:** Upload and offline states.
- **Design:** UploadStates

### M2-07 · Camera
- **Area:** app · **Priority:** P0 · **Size:** L · **Requirements:** FR-CAP-01 · **Depends on:** M2-05, M1-18 · **Issue:** #36
- **Goal:** vision-camera 4:3 preview shown 3:4, grid, slot tag and time, flash, flip, slot switcher, gallery shortcut, shutter to editor in under 1 s; a dev mock camera for the Simulator (T-106).
- **Acceptance:**
  - [ ] Slot switcher changes the target slot.
  - [ ] Shutter-to-editor under 1 s on a mid-range device.
- **Tests:** Unit test for slot switching; Maestro with the mock camera.
- **Screenshots:** Camera.
- **Design:** Camera

### M2-08 · Camera access off and gallery picker
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-CAP-11, FR-CAP-02 · **Depends on:** M2-07 · **Issue:** #37
- **Goal:** Denied-permission state with Open Settings and Choose from gallery; gallery picker entry.
- **Acceptance:**
  - [ ] Denied permission shows the Camera access off screen.
  - [ ] Any gallery photo can be chosen.
- **Tests:** Jest for the permission branch; Maestro.
- **Screenshots:** Camera access off.
- **Design:** CameraDenied

### M2-09 · Image pipeline
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-02, FR-CAP-03, FR-PRV-01 · **Depends on:** M1-03 · **Issue:** #38
- **Goal:** Crop and resize to 1440 × 1920 and 480 × 640 WebP; strip location EXIF and keep capture time; derive the target jar date from a gallery photo's timestamp.
- **Acceptance:**
  - [ ] Output files contain no GPS tags.
  - [ ] A photo taken on a past date targets that date's jar.
- **Tests:** Unit tests with fixture images containing GPS EXIF.
- **Screenshots:** —
- **Design:** —

### M2-10 · Crop screen
- **Area:** app · **Priority:** P0 · **Size:** L · **Requirements:** FR-CAP-03, FR-CAP-02 · **Depends on:** M2-09, M2-08 · **Issue:** #39
- **Goal:** Fixed 3:4 frame with lock chip and grid; drag, pinch and slider zoom; Rotate 90°, Flip, Fit, Reset, Cancel (T-107).
- **Acceptance:**
  - [ ] Non-3:4 gallery photos open Crop first.
  - [ ] Result is 1440 × 1920.
- **Tests:** Unit tests for the crop math; Maestro.
- **Screenshots:** Crop.
- **Design:** Crop

### M2-11 · Editor shell and color filters
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-04 · **Depends on:** M2-07, M2-09 · **Issue:** #40
- **Goal:** Skia canvas, tool tabs (Filters, Stickers, Bubble, Text), filter thumbnails Original, Kalamansi, Merienda, Mono, Dusk previewing the real photo (T-108).
- **Acceptance:**
  - [ ] Filters preview in real time.
  - [ ] No beauty or face-retouch filters exist.
- **Tests:** Unit tests for the color matrices.
- **Screenshots:** Capture.
- **Design:** Capture

### M2-12 · Edits data model, caption, privacy and save
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-08, FR-CAP-09 · **Depends on:** M2-11, M2-03 · **Issue:** #41
- **Goal:** Zod schema for `edits`; caption (150), Keep this moment private, Undo, Done / Add to #slot saving to the queue; reopening restores edits.
- **Acceptance:**
  - [ ] Edits are stored as data, never burned into the photo.
  - [ ] Reopening the editor restores filter and overlays.
- **Tests:** Unit tests for schema round-trips and Undo.
- **Screenshots:** Capture with caption.
- **Design:** Capture

### M2-13 · Overlay transform engine
- **Area:** app · **Priority:** P0 · **Size:** L · **Requirements:** FR-CAP-05, FR-CAP-08 · **Depends on:** M2-12 · **Issue:** #42
- **Goal:** Select, move, pinch to resize, two-finger rotate and delete overlays, with a dashed outline and handles (T-109, part 1).
- **Acceptance:**
  - [ ] Transforms are stored as position, scale and rotation relative to the photo.
- **Tests:** Unit tests for the transform math.
- **Screenshots:** —
- **Design:** Stickers

### M2-14 · Sticker catalog and free packs
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-STK-01, FR-STK-02, FR-STK-04 · **Depends on:** M1-15, M1-11 · **Issue:** #43
- **Goal:** Seed about 50 stickers across Everyday, The Eight, Stamps and Milestones with slot hints and tags; asset upload script; anon catalog read for the web (C-6) (T-110).
- **Acceptance:**
  - [ ] Packs and stickers are read from the server.
  - [ ] New rows appear in the app without an update.
- **Tests:** pgTAP for catalog read as user and anon.
- **Screenshots:** —
- **Design:** Stickers

### M2-15 · Stickers tool
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-05, FR-STK-01, FR-STK-02, FR-STK-03 · **Depends on:** M2-13, M2-14 · **Issue:** #44
- **Goal:** Sticker sheet with search and pack tabs, the current slot's suggestions first (tuned by onboarding answers), auto stamps, cached art; locked packs and shop hidden (D-6).
- **Acceptance:**
  - [ ] "For #slot" row comes first.
  - [ ] Art loads from cache after first use.
- **Tests:** Unit tests for suggestion ordering.
- **Screenshots:** Stickers tool.
- **Design:** Stickers

### M2-16 · Bubble tool
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-06 · **Depends on:** M2-13 · **Issue:** #45
- **Goal:** Speech, Thought, Shout and Whisper shapes, 6 colors, editable text up to 60 characters (T-109, part 2).
- **Acceptance:**
  - [ ] Text limit enforced; bubbles transform like stickers.
- **Tests:** Unit tests for limits.
- **Screenshots:** Bubble tool.
- **Design:** Bubble

### M2-17 · Text tool
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-07 · **Depends on:** M2-13 · **Issue:** #46
- **Goal:** Clean, Bold, Type and Serif fonts, 6 colors, size slider, left or center alignment, up to 80 characters (T-109, part 3).
- **Acceptance:**
  - [ ] Limit enforced; settings stored in `edits`.
- **Tests:** Unit tests.
- **Screenshots:** Text tool.
- **Design:** Text

### M2-18 · Moment renderer
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-STK-04, FR-CAP-08 · **Depends on:** M2-15, M2-16, M2-17 · **Issue:** #47
- **Goal:** One Skia renderer that draws photo, filter and overlays from `edits` at any size, for tiles, detail and the share card. Viewers see every sticker without owning its pack.
- **Acceptance:**
  - [ ] Same output at tile, detail and card sizes.
  - [ ] Stickers from unowned packs render.
- **Tests:** Unit tests for layout scaling.
- **Screenshots:** —
- **Design:** Moment

### M2-19 · Edge Function: moderate (photos), auto-approve for the early version (D-22)
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-SAF-03, FR-PUB-07, FR-JAR-03 · **Depends on:** M1-10, M1-15 · **Issue:** #48
- **Goal:** Triggered on moment insert and pending changes. Early version (D-22): no provider is called; every photo goes `checking` → `live` and pending photos swap in. The function keeps the provider seam so the full pipeline (CSAM gate, OpenAI omni-moderation, thresholds → live, queue or removed) drops in before public launch (T-105, part 1).
- **Acceptance:**
  - [ ] Every new or replaced photo goes live through this function.
  - [ ] Only this function sets `live`/`removed`.
  - [ ] Most photos resolve within 10 seconds.
- **Tests:** Deno tests: insert → live, replace → swap, and the database refuses `live` from any other role.
- **Screenshots:** —
- **Design:** —

### M2-20 · moderate: second opinion and child-safety match (deferred to Before public launch, D-22)
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-SAF-04, FR-SAF-03 · **Depends on:** M2-19, M1-26 · **Issue:** #49
- **Goal:** Borderline scores get a vision second opinion stored in `second_opinion` (D-13); a CSAM match blocks the photo, suspends the account, records a `csam_incidents` row and alerts, never entering the queue (T-105, part 2).
- **Acceptance:**
  - [ ] A match never creates a `moderation_items` row.
  - [ ] The account is suspended immediately.
- **Tests:** Deno tests with stubs.
- **Screenshots:** —
- **Design:** —

### M2-21 · Checking and removed states
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-PUB-07, FR-SAF-03 · **Depends on:** M2-19, M2-06 · **Issue:** #50
- **Goal:** Checking photo screen (blurred, owner-only note) and Moment removed notice.
- **Acceptance:**
  - [ ] Checking moments show blurred to the owner.
  - [ ] Removed shows the guideline and reason.
- **Tests:** Jest render tests.
- **Screenshots:** Checking photo, Moment removed.
- **Design:** Checking, Removed

### M2-22 · Replace flow
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-JAR-03 · **Depends on:** M2-04, M2-19 · **Issue:** #51
- **Goal:** Capturing into a filled slot offers Replace; the old photo stays until the new one is live.
- **Acceptance:**
  - [ ] Replace dialog appears; old photo visible to readers until moderation approves the new one.
- **Tests:** Integration test against local Supabase.
- **Screenshots:** Replace dialog (no design).
- **Design:** Main

### M2-23 · Moment options
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-CAP-10 · **Depends on:** M2-12, M2-10, M2-22 · **Issue:** #52
- **Goal:** Sheet with edit caption, edit stickers and filters, re-crop, make private, move to an empty slot in the same jar, delete with confirmation (T-111).
- **Acceptance:**
  - [ ] Each action works and updates Today.
  - [ ] Delete asks for confirmation.
- **Tests:** Jest for the sheet; integration for move and delete.
- **Screenshots:** Moment options.
- **Design:** MomentOptions

### M2-24 · month_jars RPC
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-DAY-01 · **Depends on:** M1-08 · **Issue:** #53
- **Goal:** Return the owner's jars for a month with cover thumbnail and count.
- **Acceptance:**
  - [ ] Owner-only; covers come from the first filled slot.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M2-25 · My days calendar
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-DAY-01, NFR-PERF-02, NFR-OFF-03 · **Depends on:** M2-24, M1-23 · **Issue:** #54
- **Goal:** Month view with cover photos and fill bars, today outlined, future disabled, previous months back to the first jar (T-112, part 1).
- **Acceptance:**
  - [ ] Current month readable offline.
  - [ ] "Next month" disabled for screen readers when unavailable.
- **Tests:** Unit tests for the month grid; Maestro.
- **Screenshots:** My days.
- **Design:** Calendar

### M2-26 · Fill a past day
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-DAY-02, FR-JAR-06, FR-CAP-02 · **Depends on:** M2-25, M2-07, M2-02 · **Issue:** #55
- **Goal:** Selected-day card with moments, missing slots and Fill this jar; capturing there adds to that jar with Added later (T-112, part 2).
- **Acceptance:**
  - [ ] Moments added to a past jar show Added later everywhere.
- **Tests:** Integration test; Maestro.
- **Screenshots:** My days with a selected day.
- **Design:** Calendar

### M2-27 · Milestones trigger
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-STK-05, FR-JAR-07, FR-JAR-08 · **Depends on:** M1-10 · **Issue:** #56
- **Goal:** On jar fill and jar count changes, grant the five milestones (D-8), the Milestones pack and a full-jar notification row.
- **Acceptance:**
  - [ ] Each milestone is granted once.
  - [ ] Jar counts include only jars with moments.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M2-28 · Full jar celebration and Sticker unlocked
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-JAR-07, FR-STK-05, NFR-A11Y-02 · **Depends on:** M2-27, M2-06, M1-21 · **Issue:** #57
- **Goal:** Celebration once on the 8th moment with the jar number; Sticker unlocked screen (T-113).
- **Acceptance:**
  - [ ] Shown once per jar.
  - [ ] Reduce Motion replaces confetti with a fade.
- **Tests:** Jest for the once-only rule; Maestro.
- **Screenshots:** Full jar, Sticker unlocked.
- **Design:** FullJar, StickerUnlock

### M2-29 · Time zone banner
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-JAR-05 · **Depends on:** M2-06, M2-01 · **Issue:** #58
- **Goal:** One-time banner when the new jar's zone differs from the previous one, and a zone tag on that jar.
- **Acceptance:**
  - [ ] Shown once per zone change; Got it dismisses.
- **Tests:** Unit test for the show-once rule.
- **Screenshots:** Time zone banner.
- **Design:** TimeZone

### M2-30 · Maestro flow: offline capture loop
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** NFR-OFF-01, NFR-OFF-02 · **Depends on:** M2-06, M2-12, M2-21 · **Issue:** #59
- **Goal:** End-to-end flow: capture offline, kill the app mid-upload, reopen online, moment goes live.
- **Acceptance:**
  - [ ] Flow passes on the iOS Simulator in CI or on the Mac.
- **Tests:** Maestro.
- **Screenshots:** Taken inside the flow.
- **Design:** UploadStates

### M2-31 · Usability test of the core loop
- **Area:** design · **Priority:** P0 · **Size:** M · **Requirements:** — · **Depends on:** M2-30 · **Issue:** #60
- **Goal:** Founders test the loop with 10 people and file issues (T-114).
- **Acceptance:**
  - [ ] Findings filed as issues.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

---

## M3 Social & safety (weeks 7–8)

### M3-01 · Publish review
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-PUB-01, FR-PUB-03 · **Depends on:** M2-06 · **Issue:** #62
- **Goal:** All 8 slots (empty dashed, private locked), visibility choice defaulting to the profile's default, Publish jar and Not yet (T-201).
- **Acceptance:**
  - [ ] Default is the user's default visibility.
  - [ ] Note counts private and missing moments.
- **Tests:** Jest; integration for publish.
- **Screenshots:** Publish review.
- **Design:** Publish

### M3-02 · Today published state and visibility menu
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-PUB-04, FR-PUB-03 · **Depends on:** M3-01 · **Issue:** #63
- **Goal:** Published chip, likes count and auto-share note; owner's jar menu to change visibility.
- **Acceptance:**
  - [ ] New live moments after publishing appear to readers automatically.
- **Tests:** Integration test.
- **Screenshots:** Today, published.
- **Design:** TodayPublished

### M3-03 · Feed RPC
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-01 · **Depends on:** M1-11 · **Issue:** #64
- **Goal:** `feed_page(cursor)`: published jars from authors the user reads, newest update first, 20 per page; `feed_seen_at` and new-jar author flags.
- **Acceptance:**
  - [ ] Never returns jars the user can't view.
  - [ ] Cursor pagination is stable.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M3-04 · Jars feed
- **Area:** app · **Priority:** P0 · **Size:** L · **Requirements:** FR-SOC-01, NFR-PERF-02, NFR-OFF-03 · **Depends on:** M3-03, M2-18 · **Issue:** #65
- **Goal:** Avatar row with new-jar rings, jar cards with mosaic and "+n", infinite scroll, pull to refresh, offline cache (T-202).
- **Acceptance:**
  - [ ] 20 per page; scroll stays smooth; thumbnails first.
- **Tests:** Jest for the mosaic model; Maestro.
- **Screenshots:** Jars.
- **Design:** Feed

### M3-05 · Edge Function: contacts-match
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-ONB-06, FR-SOC-02 · **Depends on:** M1-07 · **Issue:** #66
- **Goal:** Keyed hashes of contact emails and phone numbers matched against users' emails (D-4); `contact_hashes` table; rate limits.
- **Acceptance:**
  - [ ] Raw contacts never stored; blocked users never returned.
- **Tests:** Deno tests.
- **Screenshots:** —
- **Design:** —

### M3-06 · Jars, empty
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-SOC-02 · **Depends on:** M3-04, M3-05 · **Issue:** #67
- **Goal:** "Your feed is quiet" with Find people (→ Find friends, D-5), Invite friends and contact-match suggestions.
- **Acceptance:**
  - [ ] Shown only when the user reads no authors.
- **Tests:** Jest.
- **Screenshots:** Jars, empty.
- **Design:** EmptyStories

### M3-07 · Jar page
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-03, FR-JAR-06 · **Depends on:** M2-18, M3-04 · **Issue:** #68
- **Goal:** Cover with author, date, count and Full jar tag; grid of visible moments with Added later; like, comment and Share jar bar (T-203).
- **Acceptance:**
  - [ ] Private and non-live moments never appear for others.
- **Tests:** Jest; Maestro.
- **Screenshots:** Jar.
- **Design:** Story

### M3-08 · Moment detail
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-04 · **Depends on:** M3-07 · **Issue:** #69
- **Goal:** Full-screen 3:4 moment with 8 progress bars, swipe through the jar, hashtag, time, caption, likes, comments.
- **Acceptance:**
  - [ ] Swipe moves between visible moments only.
- **Tests:** Jest; Maestro.
- **Screenshots:** Moment detail.
- **Design:** Moment

### M3-09 · Likes
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-SOC-05 · **Depends on:** M3-07, M3-08, M1-10 · **Issue:** #70
- **Goal:** Optimistic like and unlike on jars and moments (T-204, part 1).
- **Acceptance:**
  - [ ] One like per user per target; counts update immediately.
- **Tests:** Jest for the optimistic update; pgTAP already covers rules.
- **Screenshots:** —
- **Design:** Story, Moment

### M3-10 · Text moderation, auto-pass for the early version (D-22)
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-SOC-06, FR-ACC-03, FR-SOC-11 · **Depends on:** M2-19 · **Issue:** #71
- **Goal:** `fn:moderate` text path for comments, usernames and bios. Early version (D-22): every comment passes at once; usernames still refuse reserved route words. The provider seam stays for the full check before public launch.
- **Acceptance:**
  - [ ] Comments become visible to others as soon as they are saved.
  - [ ] Reserved usernames are refused at save.
- **Tests:** Deno tests for the pass path and reserved names.
- **Screenshots:** —
- **Design:** —

### M3-11 · Comments
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-06 · **Depends on:** M3-07, M3-10 · **Issue:** #72
- **Goal:** Thread with one reply level, 300-character limit, delete by author or jar owner, input bar (T-204, part 2).
- **Acceptance:**
  - [ ] Own pending comments visible to the author only.
- **Tests:** Jest; integration.
- **Screenshots:** Comments.
- **Design:** Comments

### M3-12 · Profile and follow RPCs
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-07, FR-SOC-09, FR-ACC-03 · **Depends on:** M1-07 · **Issue:** #73
- **Goal:** `username_available()` with reserved names (C-2), `search_follow_list()`, remove-a-reader.
- **Acceptance:**
  - [ ] Availability is case-insensitive and respects reserved words.
  - [ ] Lists exclude blocked users.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M3-13 · My profile and Other profile
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-08, FR-JAR-08 · **Depends on:** M3-12, M2-18 · **Issue:** #74
- **Goal:** Cover, avatar, name, @username, bio, counts, Jars / Moments tabs, "Reads you" tag (T-205, part 1).
- **Acceptance:**
  - [ ] Jar count includes only jars with moments.
- **Tests:** Jest; Maestro.
- **Screenshots:** My profile, Other profile.
- **Design:** Profile, ProfileOther

### M3-14 · Follow and Readers & authors
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-07, FR-SOC-09 · **Depends on:** M3-13 · **Issue:** #75
- **Goal:** Read, Read back, Reading buttons (D-7); list switch, search, remove a reader (T-205, part 2).
- **Acceptance:**
  - [ ] Counts update on both profiles.
- **Tests:** Jest; integration.
- **Screenshots:** Readers & authors.
- **Design:** Readers

### M3-15 · Edit profile
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-11, FR-ACC-03, FR-ONB-04 · **Depends on:** M3-13, M1-15, M3-10 · **Issue:** #76
- **Goal:** Change cover, avatar, name, username (live availability within 500 ms), bio with counter, jar lid (T-205, part 3).
- **Acceptance:**
  - [ ] Availability shows within 500 ms of typing stopping.
- **Tests:** Jest for debounce.
- **Screenshots:** Edit profile.
- **Design:** EditProfile

### M3-16 · Notification triggers and preferences
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-NOT-02, FR-NOT-03, FR-NOT-04 · **Depends on:** M1-11 · **Issue:** #77
- **Goal:** Triggers for like, comment, reply, full jar, removed, appeal decided and friend joined; `notification_prefs` with per-type toggles and quiet hours.
- **Acceptance:**
  - [ ] No notification for blocked actors or private moments.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M3-17 · Edge Function: send-push 🔑
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-NOT-02, FR-NOT-04 · **Depends on:** M3-16 · **Issue:** #78
- **Goal:** Webhook → batching → Expo push, receipts, dead-token cleanup, quiet hours 10 PM–7 AM local, friend joined at most once a day (T-206).
- **Acceptance:**
  - [ ] Likes batch into one push; quiet hours respected.
- **Tests:** Deno tests with a mocked Expo API.
- **Screenshots:** —
- **Design:** LockScreen

### M3-18 · Push tokens and slot reminders
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-NOT-01, FR-NOT-02 · **Depends on:** M3-17, M2-05 · **Issue:** #79
- **Goal:** Register push tokens; schedule 7 days of local reminders, cancel a filled slot's reminder, reschedule on open, settings change and zone change, rotating copy with no streaks (T-207, part 1).
- **Acceptance:**
  - [ ] Filling a slot cancels today's reminder for it.
- **Tests:** Unit tests for the scheduler.
- **Screenshots:** Notification designs.
- **Design:** LockScreen

### M3-19 · Notifications screen
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-NOT-03 · **Depends on:** M3-16, M3-18 · **Issue:** #80
- **Goal:** Pinned reminder card while the slot is empty, Today and This week groups, tap-through, unread dot on the bell (T-207, part 2).
- **Acceptance:**
  - [ ] Tapping opens the related screen.
- **Tests:** Jest; Maestro.
- **Screenshots:** Notifications.
- **Design:** Notifications

### M3-20 · Reports backend
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-SAF-01 · **Depends on:** M1-11 · **Issue:** #81
- **Goal:** Report trigger creating moderation items; three reports in 24 h hide a moment; `report_id` and `profile_id` columns (S-11).
- **Acceptance:**
  - [ ] Reporter never visible to the reported user.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M3-21 · Report and Report sent
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SAF-01 · **Depends on:** M3-20, M3-13 · **Issue:** #82
- **Goal:** Report sheet with 7 reasons for jars, moments, comments and profiles; Report sent with Also block (T-208, part 1).
- **Acceptance:**
  - [ ] Submit sends to the moderation queue.
- **Tests:** Jest; integration.
- **Screenshots:** Report, Report sent.
- **Design:** Report, ReportThanks

### M3-22 · Block and Blocked accounts
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-SAF-02, FR-PUB-06 · **Depends on:** M3-21 · **Issue:** #83
- **Goal:** Block confirmation, Blocked accounts list with Unblock (T-208, part 2).
- **Acceptance:**
  - [ ] Blocking removes follows both ways; neither side notified.
- **Tests:** Jest; pgTAP already covers rules.
- **Screenshots:** Block, Blocked accounts.
- **Design:** Block, Blocked

### M3-23 · Edge Function: mod-action (deferred to Before public launch, D-22)
- **Area:** backend · **Priority:** P0 · **Size:** L · **Requirements:** FR-MOD-04, FR-MOD-05, FR-SAF-05, FR-SAF-06 · **Depends on:** M3-20, M2-20 · **Issue:** #84
- **Goal:** Keep, Remove, Remove and warn, Escalate; appeals decided by a different moderator; strikes and 7-day suspension (D-10, D-11); audit log rows; owner notifications.
- **Acceptance:**
  - [ ] Owner's moment and notification update within a minute.
  - [ ] Every action writes an audit row.
- **Tests:** Deno and pgTAP tests.
- **Screenshots:** —
- **Design:** —

### M3-24 · Appeal and suspension screens (deferred to Before public launch, D-22)
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-SAF-05, FR-SAF-06 · **Depends on:** M3-23, M2-21 · **Issue:** #85
- **Goal:** Request a review (one per removal) and an appeal-sent state; suspension notice (no design).
- **Acceptance:**
  - [ ] Second appeal refused.
- **Tests:** Jest.
- **Screenshots:** Moment removed with appeal, Suspension notice.
- **Design:** Removed

### M3-25 · Moderation console scaffold (deferred to Before public launch, D-22)
- **Area:** web · **Priority:** P0 · **Size:** M · **Requirements:** FR-MOD-01 · **Depends on:** M1-05 · **Issue:** #86
- **Goal:** `apps/mod` Next.js with Supabase Auth; only the moderator role gets in, everyone else sees access denied.
- **Acceptance:**
  - [ ] Non-moderators see access denied.
- **Tests:** Playwright.
- **Screenshots:** Access denied (no design).
- **Design:** ModConsole

### M3-26 · Moderation queue (deferred to Before public launch, D-22)
- **Area:** web · **Priority:** P0 · **Size:** M · **Requirements:** FR-MOD-02, FR-MOD-03 · **Depends on:** M3-25, M3-23, M1-16 · **Issue:** #87
- **Goal:** Oldest-first queue with All, Auto-check, Reports, Appeals and Escalated filters; header with pending count, median wait and open appeals; blurred thumbnails.
- **Acceptance:**
  - [ ] Photos blurred until Show photo.
- **Tests:** Playwright.
- **Screenshots:** Moderation console.
- **Design:** ModConsole

### M3-27 · Moderation detail, decisions and audit log (deferred to Before public launch, D-22)
- **Area:** web · **Priority:** P0 · **Size:** M · **Requirements:** FR-MOD-03, FR-MOD-04, FR-MOD-05, FR-SAF-05 · **Depends on:** M3-26 · **Issue:** #88
- **Goal:** Detail panel with score, caption, user history; K, R, E shortcuts; appeals; read-only audit log page (T-209).
- **Acceptance:**
  - [ ] Shortcuts work; audit log can't be edited.
- **Tests:** Playwright.
- **Screenshots:** Moderation console detail.
- **Design:** ModConsole

### M3-28 · Community guidelines and moderation playbook (deferred to Before public launch, D-22)
- **Area:** design · **Priority:** P0 · **Size:** M · **Requirements:** — · **Depends on:** M1-27 · **Issue:** #89
- **Goal:** Founders write the guidelines and the moderator playbook (T-210).
- **Acceptance:**
  - [ ] Published in `apps/web/content/legal/` and the console help.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

---

## M4 Onboarding & sharing (weeks 9–10)

### M4-01 · Welcome and How it works
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ONB-01 · **Depends on:** M1-25 · **Issue:** #91
- **Goal:** Welcome collage and three How it works screens with Skip (T-301, part 1).
- **Acceptance:**
  - [ ] Skip on each intro goes to Sign up.
- **Tests:** Maestro.
- **Screenshots:** Welcome, How it works 1–3.
- **Design:** Welcome, Intro1, Intro2, Intro3

### M4-02 · Sign up, Sign in and Check your email
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ACC-01, FR-ACC-02, FR-PRV-04 · **Depends on:** M4-01, M1-13, M1-12 · **Issue:** #92
- **Goal:** Apple, Google and email link; Check your email with a 60-second resend timer; links to Terms and Privacy (C-3).
- **Acceptance:**
  - [ ] New accounts land on About you; returning users on Today.
- **Tests:** Jest for the timer; Maestro with Inbucket.
- **Screenshots:** Sign up, Sign in, Check your email.
- **Design:** SignUp, SignIn, CheckEmail

### M4-03 · Edge Function: account-purge
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-ACC-04 · **Depends on:** M1-07 · **Issue:** #93
- **Goal:** Deletes the auth user and anything uploaded when the birthday is under 13 (G-20).
- **Acceptance:**
  - [ ] Nothing about the user remains afterwards.
- **Tests:** Deno test.
- **Screenshots:** —
- **Design:** —

### M4-04 · About you and Under 13
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ACC-03, FR-ACC-04, FR-ACC-05 · **Depends on:** M4-02, M4-03, M3-12 · **Issue:** #94
- **Goal:** Photo, name (1–40), username with live availability, birthday; Under 13 screen.
- **Acceptance:**
  - [ ] Under 13 deletes everything entered.
  - [ ] Profile saved before Continue.
- **Tests:** Jest; Maestro.
- **Screenshots:** About you, Under 13.
- **Design:** About, Under13

### M4-05 · Setup progress and Your day
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ONB-09, FR-ONB-02 · **Depends on:** M4-04 · **Issue:** #95
- **Goal:** "Step n of 6" and resume-at-step store; Your day presets and time picker saved to reminder settings.
- **Acceptance:**
  - [ ] Preset times match FR-ONB-02 exactly.
  - [ ] Quitting mid-setup resumes at the same step.
- **Tests:** Unit tests for presets and resume.
- **Screenshots:** Your day.
- **Design:** QuizDay

### M4-06 · Your people and Pick your jar
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ONB-03, FR-ONB-04 · **Depends on:** M4-05 · **Issue:** #96
- **Goal:** Multi-select chips saved privately; six lid colors with Pickle default.
- **Acceptance:**
  - [ ] Answers stored in `onboarding_answers`; lid saved to profile.
- **Tests:** Jest.
- **Screenshots:** Your people, Pick your jar.
- **Design:** QuizPeople, JarLid

### M4-07 · Permissions
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-ONB-05 · **Depends on:** M4-06, M3-18 · **Issue:** #97
- **Goal:** Reason cards before each system prompt; Notifications names the chosen times; Maybe later.
- **Acceptance:**
  - [ ] Maybe later skips all prompts.
- **Tests:** Jest.
- **Screenshots:** Permissions.
- **Design:** Permissions

### M4-08 · Find friends
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ONB-06 · **Depends on:** M4-07, M3-05 · **Issue:** #98
- **Goal:** Contact matches with Read buttons, invite link copies pickld.me/username, Skip.
- **Acceptance:**
  - [ ] Raw contacts never leave the phone.
- **Tests:** Jest; unit test for hashing.
- **Screenshots:** Find friends.
- **Design:** FindFriends

### M4-09 · Pickld Promise and First moment tip
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-ONB-07, FR-ONB-08 · **Depends on:** M4-08 · **Issue:** #99
- **Goal:** Hold 1.5 s with progress ring (timestamp saved, Skip not asked again); tip sheet over first-day Today opening Camera on the current slot.
- **Acceptance:**
  - [ ] Tip shown once.
- **Tests:** Jest for the hold timer.
- **Screenshots:** Pickld Promise, First moment tip.
- **Design:** Promise, Coach

### M4-10 · Maestro flow: onboarding
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-ONB-01, FR-ONB-09 · **Depends on:** M4-09 · **Issue:** #100
- **Goal:** Welcome through first moment, including quitting and resuming mid-setup.
- **Acceptance:**
  - [ ] Flow passes on the iOS Simulator.
- **Tests:** Maestro.
- **Screenshots:** Taken inside the flow.
- **Design:** —

### M4-11 · Share jar card
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SOC-10, FR-PUB-05 · **Depends on:** M2-18, M3-07 · **Issue:** #101
- **Goal:** Skia 9:16 image with author, date, 8 moments, optional caption, logo and pickld.me/username; Save image, Copy link, Message, Share to… (T-302).
- **Acceptance:**
  - [ ] Private moments never included.
- **Tests:** Unit test for the card model.
- **Screenshots:** Share jar card.
- **Design:** ShareCard

### M4-12 · Public web RPCs
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-WEB-01, FR-PUB-03, FR-PUB-05 · **Depends on:** M1-11, M2-14 · **Issue:** #102
- **Goal:** Anon `public_profile(username)` and `public_jar(id)` returning Everyone, live, non-private data; teaser data for Readers jars (C-6).
- **Acceptance:**
  - [ ] Readers, Only me, private and non-live data never returned.
- **Tests:** pgTAP as anon.
- **Screenshots:** —
- **Design:** —

### M4-13 · Shared-link site
- **Area:** web · **Priority:** P0 · **Size:** L · **Requirements:** FR-WEB-01, FR-WEB-03, FR-PRV-04 · **Depends on:** M4-12, M1-27 · **Issue:** #103
- **Goal:** `apps/web` Next.js: pickld.me/<username> and /j/<id> pages, Readers teaser, store buttons, legal pages (T-303, part 1).
- **Acceptance:**
  - [x] Everyone jars render; Readers jars show a teaser.
- **Tests:** Playwright at 390 px.
- **Screenshots:** Shared link web page.
- **Design:** WebShare

### M4-14 · Link preview images
- **Area:** web · **Priority:** P0 · **Size:** M · **Requirements:** FR-WEB-02 · **Depends on:** M4-13 · **Issue:** #104
- **Goal:** Server-rendered OG images of the jar card (T-303, part 2).
- **Acceptance:**
  - [x] Preview tags validate for Messenger, Facebook, X and iMessage.
- **Tests:** Playwright reads meta tags; image snapshot.
- **Screenshots:** OG image.
- **Design:** ShareCard

### M4-15 · Universal links and app links
- **Area:** web · **Priority:** P0 · **Size:** S · **Requirements:** FR-WEB-03, FR-ACC-02 · **Depends on:** M4-13, M4-02 · **Issue:** #105
- **Goal:** AASA and assetlinks files; app routes for profile, jar and auth links (T-303, part 3).
- **Acceptance:**
  - [x] With the app installed, links open the matching screen.
- **Tests:** Unit tests for link parsing (Zod); Simulator check.
- **Screenshots:** —
- **Design:** —

### M4-16 · Settings
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** FR-SET-01, FR-NOT-04, FR-PRV-04 · **Depends on:** M3-18, M3-22, M3-17 · **Issue:** #106
- **Goal:** Account card, reminders per slot with time and switch, default visibility, notification types and quiet hours, blocked accounts, legal links, sign out (My stickers hidden, D-6) (T-304, part 1).
- **Acceptance:**
  - [x] Changing reminder times reschedules local reminders.
- **Tests:** Jest; Maestro.
- **Screenshots:** Settings.
- **Design:** Settings

### M4-17 · Help & feedback
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-SET-02, FR-PRV-04 · **Depends on:** M4-16 · **Issue:** #107
- **Goal:** Searchable FAQ, Contact support and Send feedback with app version, guidelines link (T-304, part 2).
- **Acceptance:**
  - [x] Email or form includes the app version.
- **Tests:** Jest.
- **Screenshots:** Help & feedback.
- **Design:** Help

### M4-18 · Data export and account deletion functions
- **Area:** backend · **Priority:** P0 · **Size:** M · **Requirements:** FR-PRV-02, FR-PRV-03 · **Depends on:** M1-15 · **Issue:** #108
- **Goal:** `fn:data-export` zip by link within 24 h; `fn:account-delete` hides the profile at once; purge job removes everything within 30 days; `account_jobs` table (T-305).
- **Acceptance:**
  - [x] Profile hidden immediately; purge verified in tests.
- **Tests:** Deno tests; pgTAP.
- **Screenshots:** —
- **Design:** —

### M4-19 · Delete account screen
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-PRV-02, FR-PRV-03 · **Depends on:** M4-18, M4-16 · **Issue:** #109
- **Goal:** What gets removed, Download first, type DELETE, Delete my account (T-304, part 3).
- **Acceptance:**
  - [x] Button enabled only after typing DELETE.
- **Tests:** Jest.
- **Screenshots:** Delete account.
- **Design:** Delete

### M4-20 · Monitoring alerts 🔑
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-REL-01 · **Depends on:** M1-17 · **Issue:** #110
- **Goal:** Alerts when upload failures exceed 2%; uptime checks (T-306). The moderation-queue alert (older than 2 hours) ships with the console before public launch (D-22).
- **Acceptance:**
  - [ ] Alerts fire in a staging drill.
- **Tests:** Scheduled function tests.
- **Screenshots:** —
- **Design:** —

### M4-21 · Store assets, Filipino copy pass, beta recruiting
- **Area:** design · **Priority:** P0 · **Size:** M · **Requirements:** NFR-I18N-01 · **Depends on:** M4-10 · **Issue:** #111
- **Goal:** Founders prepare store screenshots, a Filipino copy pass and a beta tester list (T-308).
- **Acceptance:**
  - [ ] Assets in the repo; tester list ready.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

### M4-22 · Beta builds 🔑
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** — · **Depends on:** M4-10, M1-01 · **Issue:** #112
- **Goal:** EAS build profiles; TestFlight and Play internal testing builds (architecture: beta by week 10).
- **Acceptance:**
  - [ ] Beta builds installable by testers.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

---

## M5 Beta & launch (weeks 11–12)

### M5-01 · Accessibility pass
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-A11Y-01, NFR-A11Y-02, NFR-A11Y-03, NFR-A11Y-04 · **Depends on:** M4-22 · **Issue:** #114
- **Goal:** Audit labels, 200% text on every screen, Reduce Motion, tap areas; fix gaps (T-401).
- **Acceptance:**
  - [ ] Every screen passes the checklist at 200% text.
- **Tests:** Automated label audit test; Maestro at large text.
- **Screenshots:** Key screens at 200% text.
- **Design:** —

### M5-02 · Performance pass
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** NFR-PERF-01, NFR-PERF-02 · **Depends on:** M4-22 · **Issue:** #115
- **Goal:** Measure and fix cold and warm start and feed and calendar scrolling (T-402).
- **Acceptance:**
  - [ ] Today usable in ≤ 2 s warm and ≤ 4 s cold; 60 fps scroll.
- **Tests:** Recorded measurements in the PR.
- **Screenshots:** —
- **Design:** —

### M5-03 · Load test
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-PERF-02, NFR-REL-01 · **Depends on:** M3-03 · **Issue:** #116
- **Goal:** Load test feed and visibility functions and moderation throughput on staging (T-403, part 1).
- **Acceptance:**
  - [ ] Feed p95 under 300 ms at target load.
- **Tests:** k6 script and results.
- **Screenshots:** —
- **Design:** —

### M5-04 · Backup restore drill 🔑
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-REL-02 · **Depends on:** M1-28 · **Issue:** #117
- **Goal:** Restore a staging backup and document the runbook (T-403, part 2).
- **Acceptance:**
  - [ ] Restore tested and timed.
- **Tests:** Runbook executed.
- **Screenshots:** —
- **Design:** —

### M5-05 · Moderation threshold tuning (deferred to Before public launch, D-22)
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** FR-SAF-03 · **Depends on:** M2-20 · **Issue:** #118
- **Goal:** Tune thresholds from beta decisions; pin and alert on model version (T-403, part 3).
- **Acceptance:**
  - [ ] Threshold config versioned with rationale.
- **Tests:** Replay test over labelled beta items.
- **Screenshots:** —
- **Design:** —

### M5-06 · Analytics events verified
- **Area:** backend · **Priority:** P0 · **Size:** S · **Requirements:** NFR-ANL-01 · **Depends on:** M4-22 · **Issue:** #119
- **Goal:** Every required event fires once with no photos, captions or private moments (T-404).
- **Acceptance:**
  - [ ] Event list in NFR-ANL-01 verified in PostHog staging.
- **Tests:** Unit tests for each event call site.
- **Screenshots:** —
- **Design:** —

### M5-07 · Location data verification
- **Area:** app · **Priority:** P0 · **Size:** S · **Requirements:** FR-PRV-01 · **Depends on:** M2-09, M1-28 · **Issue:** #120
- **Goal:** Inspect files uploaded to staging and confirm no location EXIF.
- **Acceptance:**
  - [ ] Script checks a sample of uploaded files.
- **Tests:** Script output in the PR.
- **Screenshots:** —
- **Design:** —

### M5-08 · Release candidate regression
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** — · **Depends on:** M5-01, M5-02 · **Issue:** #121
- **Goal:** Run every Maestro flow on the release candidate and fix what fails.
- **Acceptance:**
  - [ ] All flows pass.
- **Tests:** Maestro.
- **Screenshots:** —
- **Design:** —

### M5-09 · Store submission 🔑
- **Area:** app · **Priority:** P0 · **Size:** M · **Requirements:** — · **Depends on:** M5-08, M4-21 · **Issue:** #122
- **Goal:** Store metadata, privacy labels and data safety form; submit for review (T-405).
- **Acceptance:**
  - [ ] Both stores accept the build.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

### M5-10 · Relaunch announcement and support inbox
- **Area:** design · **Priority:** P0 · **Size:** S · **Requirements:** — · **Depends on:** M5-09 · **Issue:** #123
- **Goal:** Founders announce on the old Facebook and X pages and open the support inbox (T-406).
- **Acceptance:**
  - [ ] Announcement posted; inbox monitored.
- **Tests:** —
- **Screenshots:** —
- **Design:** —

---

## M6 Post-launch (P1)

### M6-01 · RevenueCat webhook 🔑
- **Area:** backend · **Priority:** P1 · **Size:** M · **Requirements:** FR-STK-07 · **Depends on:** M2-14 · **Issue:** #125
- **Goal:** `fn:revenuecat-webhook` writes `owned_packs` after verified purchases.
- **Acceptance:**
  - [ ] Pack unlocks within 5 seconds of a verified receipt.
- **Tests:** Deno tests with signed webhook fixtures.
- **Screenshots:** —
- **Design:** —

### M6-02 · Sticker shop
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-STK-06 · **Depends on:** M6-01 · **Issue:** #126
- **Goal:** Seasonal banner, For you row, owned and earned packs; locked packs show a lock in the editor (reverses D-6).
- **Acceptance:**
  - [ ] Locked packs open Pack preview.
- **Tests:** Jest.
- **Screenshots:** Sticker shop, Stickers tool with locks.
- **Design:** StickerShop, Stickers

### M6-03 · Pack preview and purchase
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-STK-07 · **Depends on:** M6-02 · **Issue:** #127
- **Goal:** Preview on the user's own photo; store purchase via RevenueCat; seasonal packs stay owned.
- **Acceptance:**
  - [ ] Purchase unlocks the pack.
- **Tests:** RevenueCat sandbox test.
- **Screenshots:** Pack preview.
- **Design:** PackPreview

### M6-04 · My stickers
- **Area:** app · **Priority:** P1 · **Size:** S · **Requirements:** FR-STK-08 · **Depends on:** M6-03 · **Issue:** #128
- **Goal:** Reorder and hide packs, Restore purchases; Settings row shown.
- **Acceptance:**
  - [ ] Order and hidden state persist.
- **Tests:** Jest.
- **Screenshots:** My stickers.
- **Design:** MyStickers

### M6-05 · Memories RPCs
- **Area:** backend · **Priority:** P1 · **Size:** S · **Requirements:** FR-DAY-03 · **Depends on:** M2-24 · **Issue:** #129
- **Goal:** On this day, monthly recap and year summary queries.
- **Acceptance:**
  - [ ] Owner-only.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M6-06 · Memories screen
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-DAY-03 · **Depends on:** M6-05 · **Issue:** #130
- **Goal:** On this day card, monthly recap with photo strip, year summary.
- **Acceptance:**
  - [ ] Recap shows moments, full jars and top hashtag.
- **Tests:** Jest.
- **Screenshots:** Memories.
- **Design:** Memories

### M6-07 · Search and suggestions RPCs
- **Area:** backend · **Priority:** P1 · **Size:** M · **Requirements:** FR-EXP-01, FR-EXP-02 · **Depends on:** M3-05 · **Issue:** #131
- **Goal:** Trigram people search and suggested authors from contacts and friends of friends; Full jars today from Everyone jars.
- **Acceptance:**
  - [ ] Results within 1 second; blocked users never appear.
- **Tests:** pgTAP.
- **Screenshots:** —
- **Design:** —

### M6-08 · Explore screen
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-EXP-01, FR-EXP-02 · **Depends on:** M6-07 · **Issue:** #132
- **Goal:** Search, Suggested authors with Read, Full jars today; Jars empty "Find people" now opens Explore.
- **Acceptance:**
  - [ ] Matches the Explore design.
- **Tests:** Jest; Maestro.
- **Screenshots:** Explore.
- **Design:** Explore

### M6-09 · Widget shared storage
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-WID-01 · **Depends on:** M2-06 · **Issue:** #133
- **Goal:** Expo config plugin and shared app-group storage with today's jar and a friend's latest moment.
- **Acceptance:**
  - [ ] Data refreshed after each capture.
- **Tests:** Unit tests for the payload writer.
- **Screenshots:** —
- **Design:** Widgets

### M6-10 · iOS widgets
- **Area:** app · **Priority:** P1 · **Size:** L · **Requirements:** FR-WID-01 · **Depends on:** M6-09 · **Issue:** #134
- **Goal:** WidgetKit medium (today's jar and capture) and small (friend's latest moment).
- **Acceptance:**
  - [ ] Updates at least every 30 minutes and after each capture.
- **Tests:** Simulator check.
- **Screenshots:** Home screen widgets.
- **Design:** Widgets

### M6-11 · Android widgets
- **Area:** app · **Priority:** P1 · **Size:** L · **Requirements:** FR-WID-01 · **Depends on:** M6-09 · **Issue:** #135
- **Goal:** Glance medium and small widgets.
- **Acceptance:**
  - [ ] Same behavior as iOS.
- **Tests:** Device check.
- **Screenshots:** Home screen widgets (Android).
- **Design:** Widgets

### M6-12 · Photo storage cost review
- **Area:** backend · **Priority:** P1 · **Size:** S · **Requirements:** — · **Depends on:** M5-09 · **Issue:** #136
- **Goal:** Review R2 costs and Backblaze B2 behind Cloudflare once photo costs pass about $100 a month (T-505).
- **Acceptance:**
  - [ ] Short cost report in `docs/`.
- **Tests:** —
- **Screenshots:** —
- **Design:** —
