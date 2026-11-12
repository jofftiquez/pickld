# M4 Onboarding, sharing & account report

Nov 12, 2026. Summary issue #113. iOS captures come from the iPhone 17 Pro Simulator (iOS 27.2). Design captures come from `design/screens/*.html` at 2× with the phone frame cropped off. Web captures are Playwright at 390 px. To re-run: `maestro test apps/mobile/.maestro/onboarding.yaml` for Welcome through the first moment, and sign in as dale (`scripts/dev-sign-in.sh dale@pickld.test`) for Share, Settings, Help and Delete. Captures are JPEG at half size in `docs/milestones/M4/`.

**Android captures are missing.** The orb and its Mac satellite can't run an Android emulator (D-15).

## Screens compared with the design

| Screen                     | Files                                                                                                                                                          | Difference from the design                                                                                                                         | Intended?                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Welcome                    | `Welcome-design.jpg`, `Welcome-ios.jpg`                                                                                                                        | Matches. Photos are the design's placeholders.                                                                                                     | Yes                              |
| How it works 1–3           | `Intro1-…`, `Intro2-…`, `Intro3-…`                                                                                                                             | Matches. The jar on step 2 is the app's own jar graphic.                                                                                           | Yes                              |
| Sign up                    | `SignUp-design.jpg`, `SignUp-ios.jpg`                                                                                                                          | The email field starts empty with a placeholder, and Continue stays off until you type.                                                            | Yes                              |
| Sign in / Check your email | `SignIn-…`, `CheckEmail-…`                                                                                                                                     | Matches. The resend timer reads 0:59 because the capture came right after sending.                                                                 | Yes                              |
| About you / Under 13       | `About-…`, `Under13-…`                                                                                                                                         | The avatar shows initials (the photo picker can't be scripted). The username is "dale.david" because "dale" is taken in the seed data.             | Yes                              |
| Your day                   | `QuizDay-design.jpg`, `QuizDay-ios.jpg`, `QuizDayChange-ios.jpg`                                                                                               | Back is hidden when setup resumes on this step. Change opens 15-minute time chips, which the design doesn't show.                                  | Yes (no time-picker dependency)  |
| Your people                | `QuizPeople-…`                                                                                                                                                 | Matches. #ootd is single-choice.                                                                                                                   | Yes; veto below                  |
| Pick your jar              | `JarLid-…`                                                                                                                                                     | The jar and the "Mango it is!" bubble are slightly larger, with less space above Continue.                                                         | Yes                              |
| Permissions                | `Permissions-…`                                                                                                                                                | The times are the test account's answers (7:00 / 12:30 / 7:30), not the design's.                                                                  | Yes                              |
| Find friends               | `FindFriends-…`                                                                                                                                                | "hashed contacts" replaces "numbers". "Friends with Mika" is missing: friends-of-friends is FR-EXP-02 (P1).                                        | Yes                              |
| Pickld Promise             | `Promise-…`                                                                                                                                                    | No confetti dots. The ring is shown at rest, not mid-hold.                                                                                         | Yes; change if you want confetti |
| First moment tip           | `Coach-…`, `FirstMoment-ios` in the flow                                                                                                                       | The lid is Mango (the test's pick). Today's tiles keep their "+" buttons.                                                                          | Yes                              |
| Share jar card             | `ShareCard-…`                                                                                                                                                  | The avatar shows initials (the Jar page has no avatar photo yet). Back uses the app's glass button.                                                | Yes                              |
| Shared-link page (web)     | `WebShare-design.jpg`, `WebShare-web.jpg`, `WebShare-readers-web.jpg`                                                                                          | "Dale shared a Sunday jar" uses the display name (D-7). The App Store button hides until `APP_STORE_URL` is set. Legal pages say "being prepared". | Yes                              |
| Link previews              | `OG-jar.png`, `OG-readers.png`                                                                                                                                 | 1200×630 landscape. Filters and stickers aren't drawn (the image renderer can't). Readers previews have no photos.                                 | Yes (renderer limit, privacy)    |
| Universal link             | `Link-jar-ios.jpg`                                                                                                                                             | No design. A pickld.me jar link opens the Jar page in the app.                                                                                     | —                                |
| Settings                   | `Settings-design.jpg`, `Settings-ios.jpg`, `Settings-bottom-ios.jpg`, `Profile-gear-ios.jpg`                                                                   | My stickers is hidden (D-6). Removal and appeal notices can't be turned off. A gear on your own profile opens Settings.                            | Yes                              |
| Help & feedback            | `Help-design.jpg`, `Help-ios.jpg`, `Help-search-ios.jpg`                                                                                                       | The sticker-restore question waits for sticker sales (D-6).                                                                                        | Yes                              |
| Delete account             | `Delete-design.jpg`, `Delete-ios-empty.jpg`, `Delete-ios-lowercase.jpg`, `Delete-ios-armed.jpg`, `Delete-ios-export-pending.jpg`, `Delete-ios-export-done.jpg` | Matches. Delete turns on only for exactly "DELETE". The download card also shows Preparing and Open (until a date and time).                       | Yes                              |

## What shipped

19 of 22 tasks are done. M4-20 and M4-22 are built as far as the code goes and wait on founder accounts. M4-21 is a founder task.

- **Onboarding:** Welcome, How it works, Sign up / Sign in / Check your email, About you and Under 13 (which deletes everything entered), setup progress with resume, Your day, Your people, Pick your jar, Permissions with Maybe later, Find friends (contacts hashed on the phone, D-28), the Pickld Promise and the First moment tip. A Maestro flow covers Welcome through the first moment.
- **Sharing:** the Share jar card (Save image, Copy link, Message, Share to; private moments never included), anon `public_profile` / `public_jar` RPCs (0025), the shared-link site `apps/web` with `fn:public-page` signing photos (D-32), link-preview images and tags, and universal links / app links (D-33).
- **Account:** Settings, Help & feedback, `fn:account-purge` (Under 13), data export and account deletion (`account_jobs`, 0026; `fn:data-export`, `fn:account-delete`, `fn:account-jobs`), and the Delete account screen. End to end on the local stack: export → zip link → delete hides the profile at once → the purge removes the auth user, profile and photos 7 days after the export.
- **Operations:** the `upload_result` signal and `fn:health` for alerts (D-34), and EAS build and submit profiles (D-35).

**Tests:** 128 Jest suites (1326 tests) plus 6 integration suites against local Supabase, 1340 pgTAP tests (owner, reader, outsider and blocked user for every RLS change; anon for the public RPCs), 87 Edge Function tests, and the web site's Playwright and unit tests. CI is green on main.

**Requirement IDs satisfied:** FR-ACC-01 to FR-ACC-05, FR-ONB-01 to FR-ONB-09, FR-PRV-02 to FR-PRV-04, FR-PUB-03, FR-PUB-05, FR-SET-01, FR-SET-02, FR-SOC-10, FR-WEB-01 to FR-WEB-03, FR-NOT-04.

Partly covered:

- **NFR-REL-01:** the signals exist; the alerts and their staging drill need the founders' Sentry/PostHog projects (D-34). The moderation-queue alert waits for the console (D-22).
- **NFR-I18N-01:** dates and times follow the phone's locale; the Filipino copy pass is M4-21 (founders).
- **FR-SOC-02 (People you may know on the empty Jars feed):** contacts matching works in Find friends; the empty-feed card is not built yet.

## What slipped and why

- **M4-20 Monitoring alerts:** code merged (#248); the alert rules and the drill need founder accounts.
- **M4-21 Store assets, Filipino copy, beta testers:** founder work.
- **M4-22 Beta builds:** profiles ready (#249); builds need the Expo project and the Apple and Google accounts.
- **The M2 usability test (#60):** still needs 10 real people.
- **Android captures:** missing (D-15).

## Waiting on the product owner

1. **`support@pickld.me`** is a guess for Help's email address. Is it right?
2. **#ootd single-choice** on Your people. Multi-choice needs a small schema change.
3. **Purging a moderator account would fail:** `moderation_items.decided_by` and `audit_log.actor_id` have no on-delete action. Set `decided_by` to null when a moderator deletes their account, or keep their records and refuse the delete?
4. **Pickld Promise:** add the confetti dots from the design, or keep it plain?

## Founder tasks

- **Supabase (staging and production):** `ACCOUNT_JOBS_SECRET`, plus the still-open `CONTACT_HASH_SECRET` and `PUSH_CRON_SECRET`. Cron jobs: POST `fn:account-jobs` every few minutes (header `x-jobs-secret`) and `fn:send-push` every minute (header `x-push-secret`), each with the anon key as Bearer. Apple and Google sign-in credentials in Supabase Auth.
- **Web deploy (Vercel):** `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` and `APP_STORE_URL`. Legal pages in `apps/web/content/legal/`. After deploy, test a jar link in the Facebook Sharing Debugger and X's card validator.
- **Monitoring (D-34):** a PostHog alert on failed / (uploaded + failed) above 2% per hour; Sentry Uptime on `fn:health` and pickld.me; a Sentry alert on new production issues; then the staging drill.
- **Beta builds (D-35):** Expo project (`EAS_PROJECT_ID`, `EXPO_OWNER`), staging values in the EAS `preview` environment, the App Store Connect app for `me.pickld.app`, a Play service account, APNs/FCM credentials. Then `npx eas-cli build --profile beta --platform all` and `npx eas-cli submit --profile beta`.
- **M4-21:** store screenshots, the Filipino copy pass and the beta tester list. Replace the placeholder photos before any public use.

## Follow-ups

- **Analytics events aren't wired:** `track()` has an allowlist but, before `upload_result`, nothing called it. Sign-up steps, first moment, publish, follows and the rest of NFR-ANL-01 need calls; that's M5-06.
- **Old export zips** stay in the bucket until the account is deleted.
- **Maestro:** the first tap on "Take my first moment" is ignored under Maestro only.
- **`send_push_test` "due likes batch"** is flaky on liker order; a suggested fix was filed.
- **Local stacks** created before 0026 need `application/zip` allowed on the photos bucket (`pnpm db:reset` does it).

## Decisions made during M4

D-28 `expo-contacts`, D-29 no comment likes, D-30 no report-decision notification, D-31 `expo-media-library` / `expo-sharing` / `expo-clipboard`, D-32 shared-link photos signed by `fn:public-page`, D-33 universal links, D-34 monitoring signals, D-35 EAS beta builds.

## Next: the first three M5 issues

- #114 M5-01 Accessibility pass (NFR-A11Y-01 to NFR-A11Y-04)
- #115 M5-02 Performance pass (NFR-PERF-01, NFR-PERF-02)
- #116 M5-03 Load test (NFR-PERF-02, NFR-REL-01)

M5 starts only after jofftiquez approves this report.
