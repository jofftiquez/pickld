# M3 Social & safety report

Nov 12, 2026. Summary issue #90. iOS captures come from the iPhone 17 Pro Simulator (iOS 27.3). Design captures come from `design/screens/*.html` at 2× with the phone frame cropped off. To re-run: sign in with `scripts/dev-sign-in.sh dale@pickld.test`, then `maestro test apps/mobile/.maestro/<flow>.yaml` (today-published, publish-review, jars-feed, jars-empty with lola, jar-page, moment-detail, comments, profiles, readers, edit-profile, reminders, notifications, report, block). Captures are JPEG at half size.

**Android captures are missing.** The orb and its Mac satellite can't run an Android emulator (D-15).

## Screens compared with the design

| Screen                     | Files                                                                                      | Difference from the design                                                                                                                                                                                      | Intended?                |
| -------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Today published            | `TodayPublished-design.jpg`, `TodayPublished-ios.jpg`, `JarVisibility-ios.jpg`             | Matches. The visibility menu has no design; it's built from the kit sheet and the Publish choices.                                                                                                              | Yes                      |
| Publish                    | `Publish-design.jpg`, `Publish-ios.jpg`                                                    | Matches, apart from the selected radio having a green ring instead of a dark one.                                                                                                                               | Yes (kit radio)          |
| Jars feed                  | `Feed-design.jpg`, `Jars-ios.jpg`                                                          | Matches. The "new" ring shows only on authors with unseen jars. The bell's dot shows unread notifications (M3-19).                                                                                              | Yes                      |
| Jars, empty                | `EmptyStories-design.jpg`, `JarsEmpty-ios.jpg`                                             | **No "People you may know"**: it waits on the `expo-contacts` question. The fanned photo cards are icon tiles.                                                                                                  | Waiting on product owner |
| Jar page                   | `Story-design.jpg`, `Jar-ios.jpg`, `JarAddedLater-ios.jpg`                                 | Matches, with "⋯" (Report) on other people's jars. A backfilled cover shows "Added later" in the caption line, and tiles show the badge.                                                                        | Yes                      |
| Moment detail              | `Moment-design.jpg`, `Moment-ios.jpg`                                                      | Matches. The photo runs full-bleed under the status bar (fixed in #226).                                                                                                                                        | Yes                      |
| Comments                   | `Comments-design.jpg`, `Comments-ios.jpg`, `CommentsReplies-ios.jpg`                       | **No comment likes**: `reactions.target` allows only jar and moment, so likes need a schema change. Delete and Report are text actions.                                                                         | Question below           |
| My profile / Other profile | `Profile-design.jpg`, `Profile-ios.jpg`, `ProfileOther-design.jpg`, `ProfileOther-ios.jpg` | Seed users have no cover photo, so the cover is a flat colour. There's no settings gear (Settings is M4-16), and there's an extra Share button.                                                                 | Yes                      |
| Readers & authors          | `Readers-design.jpg`, `Readers-ios.jpg`                                                    | Matches, plus a hint that a long press removes a reader.                                                                                                                                                        | Yes                      |
| Edit profile               | `EditProfile-design.jpg`, `EditProfile-ios.jpg`, `EditProfileChanged-ios.jpg`              | Matches, apart from the image icon on Change cover.                                                                                                                                                             | Yes                      |
| Reminder (lock screen)     | `LockScreen-design.jpg`, `Reminder-ios.jpg`, `ReminderList-ios.jpg`                        | The banner copy matches. The list is a dev-only screen and doesn't ship. Social pushes need an EAS project id (founder task).                                                                                   | Yes                      |
| Notifications              | `Notifications-design.jpg`, `Notifications-ios.jpg`                                        | Matches. The reminder card shows while the current slot is empty; it isn't in the capture because the Simulator clock was outside any slot.                                                                     | Yes                      |
| Report / Report sent       | `Report-design.jpg`, `Report-ios.jpg`, `ReportThanks-design.jpg`, `ReportSent-ios.jpg`     | Matches. Report sent drops "and we'll let you know what we decide", because no decision notification goes to reporters yet.                                                                                     | Question below           |
| Block / Blocked accounts   | `Block-design.jpg`, `Block-ios.jpg`, `Blocked-design.jpg`, `Blocked-ios.jpg`               | Matches. Blocked people show initials, because their photo can't be signed while the block hides them. The copy says "them", not "her". Blocked accounts opens by deep link until Settings (M4-16) links to it. | Yes                      |

## What shipped

22 of 28 tasks are done. M3-23 to M3-28 (mod-action, appeals, the moderation console and the guidelines) are deferred to Before public launch by D-22.

- **Publishing and feed:** Publish review and the visibility menu, `feed_page` / `feed_authors` / `mark_feed_seen`, the Jars feed with an offline cache, and the empty state.
- **Reading:** the Jar page, Moment detail (swiping through visible moments only), likes, and comments with replies (text moderation auto-passes, D-22).
- **People:** profile and follow RPCs, My profile and Other profile, Read / Read back / Reading, Readers & authors, and Edit profile with avatar and cover photos (keys checked in the database, 0018). `fn:contacts-match` exists on the backend.
- **Notifications:** triggers and preferences (0019), `fn:send-push` with batched likes, quiet hours and receipts (0020), local slot reminders and push token registration, and the Notifications screen with an unread dot.
- **Safety:** reports (0021: one per person per target, moderation items, three reporters in 24 h hide a moment, the reporter is never visible), the Report sheet, and Block / Blocked accounts (0022).

**Tests:** 106 Jest suites (1207 tests), plus 6 integration suites against local Supabase. 1225 pgTAP tests, covering owner, reader, outsider and blocked user for every RLS change. 55 Edge Function tests.

**Requirement IDs satisfied:** FR-PUB-01, FR-PUB-03, FR-PUB-04, FR-PUB-06, FR-JAR-06, FR-SOC-01, FR-SOC-03 to FR-SOC-11, FR-ACC-03, FR-NOT-01 to FR-NOT-03, FR-SAF-01, FR-SAF-02, NFR-PERF-02, NFR-OFF-03.

Partly covered:

- **FR-SOC-02 and FR-ONB-06:** contacts-match is built; the app side waits on `expo-contacts`.
- **FR-NOT-04:** preferences and quiet hours are on the server; the settings screen is M4-16.

## What slipped and why

- **"People you may know" and Find friends:** waiting on approval for `expo-contacts` (not in AGENTS.md).
- **M3-23 to M3-28:** deferred by D-22.
- **The M2 usability test (#60):** needs 10 real people; still not done.
- **Android captures:** missing (D-15).

## Waiting on the product owner

1. **`expo-contacts`** (free, Expo SDK): may it be added for People you may know and M4-08 Find friends?
2. **Comment likes:** the design shows a heart on each comment. It needs `comment` added to the `reactions` target check, an additive change. Build it, or drop the heart?
3. **Report decisions:** should reporters get a notification when a moderator decides (a new notification type)? If not, the dropped line stays out.

## Founder tasks

- On staging and production:
  - `supabase secrets set CONTACT_HASH_SECRET=$(openssl rand -hex 32)`
  - `supabase secrets set PUSH_CRON_SECRET=$(openssl rand -hex 32)`
  - optionally `EXPO_ACCESS_TOKEN`
- A Supabase Cron job that POSTs to `/functions/v1/send-push` every minute with the `x-push-secret` header.
- An EAS project id and APNs/FCM credentials, so devices can register push tokens.

## Follow-ups

- **Feed pagination:** a jar that gets a new moment mid-scroll moves above the cursor and is skipped until pull to refresh. There's no feed index yet; M5-03 may need one.
- **Moderator decisions on reports:** "removed" leaves the moment hidden but doesn't set `removed`; that's the moderation tool's job (M3-23, deferred).
- **The block flow** leaves dale not reading jun in local data; re-seed after running `block.yaml`.

## Decisions made during M3

None new; M3 followed D-1 to D-27.

## Next: the first three M4 issues

- #91 M4-01 Welcome and How it works (FR-ONB-01)
- #92 M4-02 Sign up, Sign in and Check your email (FR-ACC-01, FR-ACC-02, FR-PRV-04)
- #93 M4-03 Edge Function: account-purge (FR-ACC-04)

M4 starts only after jofftiquez approves this report.
