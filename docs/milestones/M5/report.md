# M5 Beta & launch report

Nov 12, 2026. Summary issue #124. iOS captures come from the iPhone 17 Pro Simulator (iOS 27.2). M5 adds no new screens: it hardens the existing ones. The 25 large-text captures (AX3, about 200% text) are in `docs/milestones/M5/LargeText-*-ios.jpg`. The four before/after pairs were posted to the Space with the M5-01 report.

**Android captures are missing.** The orb and its Mac satellite can't run an Android emulator (D-15).

## Per task

| Task                          | Issue | State                                     | Evidence                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ----- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5-01 Accessibility pass      | #114  | Done, #252                                | Every screen holds at 200% text; an audit in `pnpm test` fails on unlabelled pressables and unexplained fixed-size text; a contrast test checks every text/background token pair against WCAG AA; `large-text.yaml` passes at AX3 (D-37)                                                           |
| M5-02 Performance pass        | #115  | Measured, #254; open for a real phone     | Release build: cold start median **2.2 s** (target ≤ 4 s), warm start **0.8 s** (≤ 2 s). Feed scroll on the Simulator 50–56 fps (7–8% dropped frames, versus 2% for iOS Settings scrolled the same way). Three fixes made no measurable difference, so none shipped (`docs/milestones/M5/perf.md`) |
| M5-03 Load test               | #116  | Local run, #255; open for staging         | k6, 50 readers for 2 min (target D-38): `feed_page` p95 **57 ms**, `photo-urls` p95 **32 ms**, 0 of 9,859 requests failed. At 200 readers the single local machine saturates (p95 463 / 878 ms) (`docs/milestones/M5/load.md`)                                                                     |
| M5-04 Backup restore drill 🔑 | #117  | Runbook, #256; drill is the founders'     | `docs/runbooks/backup-restore.md`; local rehearsal restores in 0.65 s with row counts, policies, triggers and migrations matching. Must run as `supabase_admin`                                                                                                                                    |
| M5-05 Moderation tuning       | #118  | Parked (D-22, Before public launch)       | —                                                                                                                                                                                                                                                                                                  |
| M5-06 Analytics events        | #119  | Code done, #253; open for PostHog staging | Every NFR-ANL-01 event fires once from its call site, with tests; no photos, captions or private moments                                                                                                                                                                                           |
| M5-07 Location data check     | #120  | Script, #257; open for staging R2         | `deno task exif-check`: 73 local uploads, 0 with location; a JPEG and a WebP with real GPS EXIF were caught                                                                                                                                                                                        |
| M5-08 RC regression           | #121  | Done, #258                                | **36 of 36 Maestro flows pass** (Debug build of main, because the flows use dev routes) (`docs/milestones/M5/regression.md`)                                                                                                                                                                       |
| M5-09 Store submission 🔑     | #122  | Founders                                  | Needs the store accounts and M4-21                                                                                                                                                                                                                                                                 |
| M5-10 Announcement and inbox  | #123  | Founders                                  | After M5-09                                                                                                                                                                                                                                                                                        |

## Differences found and fixed

- **A photo taken right after flying west never uploaded (FR-JAR-04, fixed in #258).** A photo joining the open jar was queued with the jar's date but the phone's zone. When the open jar's date was ahead of the phone's, the server refused it and the photo ended as Didn't upload. It now keeps the jar's zone. Found by `offline-loop`, retested in the same situation, and covered by unit tests that fail on the old code.
- **Three flows** broke on test mechanics, not the app: the email field's new Send key from M5-01, and a race with the iOS permission prompt. All three are fixed.
- **`send_push_test`** compared two likes inserted with the same time, so its order was a coin toss; the test now gives them different times (#255).

## Product owner's choices (all confirmed, D-39)

1. Help's address is `support@pickld.me`.
2. #ootd stays single-choice.
3. Moderator records are kept: an account that decided a moderation item or is in the audit log can't self-delete (0027).
4. The Pickld Promise has no confetti.
5. Load-test target: 50 readers at once, p95 under 300 ms (D-38).
6. Skip, Maybe later and Skip for now count as completing an onboarding step, and sign-up counts once the email link is sent (analytics).

**Tests:** 134 Jest suites (1385 tests) plus 6 integration suites against local Supabase, 1348 pgTAP tests, 87 Edge Function tests, the a11y audit and the photo worker's tests. CI is green on main.

**Requirement IDs satisfied:** NFR-A11Y-01 to NFR-A11Y-04, NFR-PERF-01, NFR-ANL-01 (code), FR-JAR-04 (travel-rule fix).

Partly covered:

- **NFR-PERF-02:** the feed's 60 fps needs a real iPhone (and an Android phone, D-15). The local load test passes; staging is the founders' run.
- **NFR-REL-02:** the runbook is tested locally; the timed staging drill is the founders'.
- **FR-PRV-01:** the audit passes locally; the staging R2 run needs a read-only token.

## Founder tasks (carried over and new)

- **Staging checks (new in M5):**
  - run `scripts/load/feed.js` against staging (#116)
  - the timed restore drill (#117)
  - PostHog staging event check (#119)
  - `deno task exif-check` against staging R2 with a read-only token (#120)
  - feed scrolling on a real iPhone, via Instruments' Animation Hitches (#115)
- **Store:** submission (#122), then the announcement and the support inbox (#123).
- **Still open from M4:** Supabase secrets and cron jobs (`ACCOUNT_JOBS_SECRET`, `CONTACT_HASH_SECRET`, `PUSH_CRON_SECRET`); Apple and Google sign-in; Vercel variables; monitoring alerts (D-34); EAS beta builds (D-35); M4-21 store assets, Filipino copy and testers; the M2 usability test (#60).

## Next

M6 (post-launch P1) is pre-approved. It continues on jofftiquez's Mac runner, iOS only; see `docs/handoff.md`.
