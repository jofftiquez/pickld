# Handoff: Pickld 2.0, M6 on jofftiquez's Mac runner

Nov 12, 2026. Written by the orb thread that built M3 to M5 (https://ampcode.com/threads/T-01a1ccb2-c1a1-7259-8905-983637617e89). jofftiquez wants M6 and everything after it to run on his Mac runner, **iOS only**. Start by reading `AGENTS.md`, then this file, `docs/plan.md` (M6 section) and `docs/decisions.md` (D-1 to D-39).

## 1. Where things stand

- **M1–M5 are done** apart from founder tasks and the moderation work parked for "Before public launch" (D-22). The reports are in `docs/milestones/M1…M5/report.md`. M5's is merged and posted to the Space thread T-01a1c5b7-2fb4-7704-897c-7a6b6d57c9b6.
- **main is green.** No PRs are open and nothing is left unpushed.
- **Open issues are all founder work or summaries:**

| Issue                  | What it needs                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| #1, #12, #27, #28      | Vendor accounts, Apple/Google sign-in, legal, staging/prod pipeline                             |
| #60                    | The M2 usability test (10 real people)                                                          |
| #110, #112, #111       | Monitoring alerts (D-34), EAS beta builds (D-35), M4-21 store assets, Filipino copy and testers |
| #115                   | The 60 fps feed check on a real iPhone (`docs/milestones/M5/perf.md`)                           |
| #116, #117, #119, #120 | Staging runs: load test (D-38), restore drill, PostHog events, location audit on R2             |
| #49, #84–#89, #118     | Moderation work parked for "Before public launch" (D-22)                                        |
| #122, #123             | Store submission, announcement and support inbox                                                |
| #29, #61, #113, #124   | Milestone summaries M1, M2, M4, M5 (they stay open while founder items remain)                  |

## 2. The product owner's pre-approvals (Space, Nov 12, "Approve all")

1. **M5 is approved** now that its report is posted, so **M6 (post-launch P1) may start.**
2. **The agent's defaults stand** (D-36, D-38, D-39):
   - the support address `support@pickld.me`
   - #ootd single-choice
   - moderator records kept (an account with moderator records can't self-delete)
   - no Promise confetti
   - the 50-reader load target
   - Skip and sign-up counting as completed onboarding steps
3. **Free Expo SDK libraries that M6 needs may be added without asking.** Anything paid still waits for him.
4. **Fix any differences a milestone report finds before moving on.**

**Still stop and ask for:**

- anything paid, including turning on real purchases
- schema drops or renames
- product-rule changes
- anything that needs his accounts, keys or a real phone

"Before public launch" (D-22) stays parked. At the end of M6, post the M6 report and wait for his approval.

## 3. M6 notes

Plan order: M6-01 RevenueCat webhook 🔑 (#125), M6-02 Sticker shop (#126), M6-03 Pack preview and purchase (#127), M6-04 My stickers (#128), M6-05/06 Memories (#129, #130), M6-07/08 Search and Explore (#131, #132), M6-09/10 widgets (#133, #134), then M6-12 storage cost review (#136).

- **M6-11 Android widgets (#135): skip.** He asked for iOS only; list it as not done in the M6 report.
- **Purchases:** RevenueCat is in AGENTS.md. Build against its sandbox and test mode only; real purchases and store products need his accounts. D-6 hid My stickers and sticker restore until sales exist, so M6-02 to M6-04 bring them back.
- **Widgets (M6-09/10):** they need an App Group and a widget extension (a native target). Use the Expo config-plugin route, and run `scripts/prepare-native.sh` (D-35) after changing native config.

## 4. Standing rules (unchanged)

- **Overnight-style work:** keep going between issues. Never end a turn while waiting on CI: block with `timeout 55 gh pr checks N --watch --interval 15` and loop.
- **Merging:** merge your own PRs (`gh pr merge N --squash --delete-branch`) after a green `ci`. Then tick the issue boxes and close the issue, or comment if it stays open for founder work.
- **Commits:** format is `FR-ID: description`. The runner may have a global hook that adds a co-author line, so commit with `git -c core.hooksPath=/dev/null commit` if it does.
- **Public repo:** never commit secrets, `.env.example` only. Restore `supabase/functions/deno.lock` before committing, and scan diffs before pushing. Scan every diff for `eyJ`, `sk-`, `phc_`, `service_role`, `sb_secret` and `-----BEGIN`; vendor keys live in the runner's local env or Amp secrets.
- **Screenshots:** when a screen PR merges, send the Space thread design next to iOS images with send_thread_message `media_paths`. Start each report with "Worker report from <thread URL>:" and use the parts Result / Not done / Where / Next. No Android captures; say so once per report.
- **Subagents:** allowed for parts that don't touch the same files, each in its own git worktree.

## 5. Mac notes

- **Local Supabase** runs on ports **55420–55429**: API 55421, DB 55422, Studio 55423, Mailpit 55424. The photo worker runs on 55430.
  - Start it with `pnpm db:start`, then `pnpm db:reset` and `(cd workers/photos && deno task seed)` for the seed users and photos.
  - Edge Functions: `pnpm exec supabase functions serve --env-file supabase/functions/.env`. The photo worker: `(cd workers/photos && deno task dev)`.
  - Copy each `.env.example` to `.env` (`supabase/functions`, `workers/photos`, `apps/mobile`). `.agents/setup` shows how the orb generates the local secrets.
  - For the Simulator set `PHOTO_BASE_URL=http://127.0.0.1:55430` in `supabase/functions/.env`: the photo worker listens only on 127.0.0.1, so a LAN address signs photo URLs that never load (every photo shows as an empty tile). Restart `functions serve` after changing it.
- **iOS Simulator only.** No Android emulator, no Android captures (D-15). `scripts/mac-setup.sh` installs JDK 17 and Maestro 2.12.1.
- **Dev build:** `apps/mobile/ios` is generated and ignored. After a native dependency changes, run `cd apps/mobile && npx expo prebuild --platform ios --clean --no-install`, then `cd ios && LANG=en_US.UTF-8 pod install` (CocoaPods fails without UTF-8). Then `xcodebuild -workspace Pickld.xcworkspace -scheme Pickld -configuration Debug -sdk iphonesimulator -derivedDataPath build build` and `xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/Pickld.app`. Metro: `cd apps/mobile && npx expo start --port 8081`.
- **Sign in on the Simulator:**
  1. `bash scripts/dev-sign-in.sh dale@pickld.test` prints a `pickld://dev/sign-in?token=…` link.
  2. Open it with `xcrun simctl openurl booted "<link>"` and tap Open in the dialog.
  - Seed users: dale, mika, aya, jun and lola (`@pickld.test`), plus `mod@pickld.test`.
- **Maestro:** each flow's header says what state it needs. `docs/milestones/M5/regression.md` lists the groups and resets that make all 36 pass. Take screenshots with `scripts/capture.sh`.
- **Performance and load:** `scripts/perf/` (start and scroll measurements, Release build) and `scripts/load/` (k6 in Docker).
- **Checks:**
  - `pnpm typecheck && pnpm lint`
  - `cd apps/mobile && CI=1 npx jest --forceExit`
  - `pnpm fn:test`
  - `pnpm exec supabase test db`
  - `pnpm db:types:check`
- **Times near midnight:** the seed dates jars relative to "today" in each jar's zone. A reset just after Manila's midnight makes dale's open jar tomorrow's while a UTC Simulator is still on today; the app now handles that (#258).
