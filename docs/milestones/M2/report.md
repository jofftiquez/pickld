# M2 Capture loop report

Nov 11, 2026. Summary issue #61. iOS captures come from the iPhone 17 Pro Simulator (iOS 27.3) after a native rebuild that adds expo-image-picker, React Native Skia and expo-network. Design captures come from `design/screens/*.html` through `node scripts/capture-design.mjs M2 <Screens…>`. To re-run: sign in with `scripts/dev-sign-in.sh dale@pickld.test`, then `maestro test apps/mobile/.maestro/<flow>.yaml` (today, moment-states, my-days, camera, camera-denied, crop, editor-tools, replace-dialog, moment-options, moment-options-apply, fill-past-day, full-jar, timezone-banner, offline-loop). Captures are JPEG at half size to keep the repo small.

**Android captures are missing.** The orb and its Mac satellite can't run an Android emulator (D-15).

The M1 report (`docs/milestones/M1/`) was deleted by mistake in the M2-07 Camera squash (#179); this PR restores it unchanged from 9d2f68d.

The mock camera on the Simulator always returns the same street photo, so many tiles look alike. The other photos come from seed data.

## Screens compared with the design

| Screen                    | Files                                                                                                                          | Difference from the design                                                                                                                                                      | Intended?                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Main (Today)              | `Main-design.jpg`, `Main-ios.jpg`                                                                                              | Matches: jar card, 8 slots, empty and Now tiles, Checking tile, private lock. Publish is disabled.                                                                              | Yes: publishing is M3 (#62)                                      |
| Upload states             | `UploadStates-design.jpg`, `UploadStates-online-ios.jpg`, `UploadStates-offline-ios.jpg`                                       | Offline banner and Waiting for connection match. The Uploading % and Didn't upload + Retry states aren't in these captures (they're covered by Jest and the offline-loop flow). | Yes                                                              |
| Camera                    | `Camera-design.jpg`, `Camera-ios.jpg`                                                                                          | Matches. Taken slots are struck through in the switcher. The gallery shortcut is an icon, not the last photo's thumbnail.                                                       | Yes: the app doesn't read the photo library until the user picks |
| Camera access off         | `CameraDenied-design.jpg`, `CameraDenied-ios.jpg`                                                                              | Matches.                                                                                                                                                                        | Yes                                                              |
| Crop                      | `Crop-design.jpg`, `Crop-ios.jpg`                                                                                              | Matches, but on a 6.3" phone **Next: edit sits below the fold** and the sheet must be scrolled.                                                                                 | **No: follow-up issue**                                          |
| Capture (editor, Filters) | `Capture-design.jpg`, `Capture-with-caption-ios.jpg`                                                                           | The private control is the kit's switch, not a checkbox. The photo has no slot tag or close button on top while the sheet is open.                                              | Switch: yes (kit). Tag: open to review                           |
| Stickers                  | `Stickers-design.jpg`, `Stickers-ios.jpg`                                                                                      | Matches the packs (For #slot, Everyday, The Eight, Stamps). No shop banner, and the caption field sits under the tool.                                                          | Yes: the shop is M6                                              |
| Bubble                    | `Bubble-design.jpg`, `Bubble-ios.jpg`                                                                                          | Matches the four shapes and colours. The editor keeps caption, privacy and the Add button in view instead of Done.                                                              | Yes: one sheet saves the moment                                  |
| Text                      | `Text-design.jpg`, `Text-ios.jpg`                                                                                              | Matches the four styles, colours, size and alignment.                                                                                                                           | Yes                                                              |
| Moment renderer on Today  | `Today-edits-ios.jpg` (design: `Moment-design.jpg`)                                                                            | Today's #afternoon tile draws the saved sticker, bubble and text at tile scale. The full Moment viewer (`/moment/[id]`) comes in M3.                                            | Yes                                                              |
| Checking                  | `Checking-design.jpg`, `CheckingPhoto-ios.jpg`                                                                                 | Matches; the spinner is the native one.                                                                                                                                         | Yes                                                              |
| Removed                   | `Removed-design.jpg`, `MomentRemoved-ios.jpg`                                                                                  | No reason category, Request a review or guidelines link.                                                                                                                        | Yes: appeals are M3-24 (#85), guidelines T-210                   |
| Replace dialog            | `ReplaceDialog-ios.jpg`                                                                                                        | No design screen; built with the kit Dialog and the copy from the product docs.                                                                                                 | Open to review                                                   |
| Moment options            | `MomentOptions-design.jpg`, `MomentOptions-ios.jpg`, `-caption`, `-move`, `-delete`, `-edited`, `-recropped`, `Recrop-ios.jpg` | Matches. The delete confirmation and the slot picker use the kit Dialog and Sheet.                                                                                              | Yes                                                              |
| My days                   | `Calendar-design.jpg`, `Calendar-ios.jpg`, `MyDays-selected-day-ios.jpg`                                                       | Matches: covers, fill bars, selected day, missing slots, Fill this jar, "Added later" note. No View jar link.                                                                   | Yes: the Jar page is M3-07 (#68)                                 |
| Full jar                  | `FullJar-design.jpg`, `FullJar-ios.jpg`                                                                                        | Matches, with Done instead of Publish jar and Share jar card.                                                                                                                   | Yes: publish is M3, share card M4-11                             |
| Sticker unlocked          | `StickerUnlock-design.jpg`, `StickerUnlock-ios.jpg`                                                                            | Shows "1 of 5 earned" (the five milestone stickers that exist) instead of 12. Done instead of Use it now, and no Share link.                                                    | Yes: count follows the catalog; share is M4                      |
| Time zone banner          | `TimeZone-design.jpg`, `TimeZone-ios.jpg`                                                                                      | Captured with Bangkok instead of Tokyo. The copy names the last jar's zone rather than the hour today's jar ends.                                                               | Open to review                                                   |
| Empty first day           | `EmptyToday-design.jpg`                                                                                                        | Not recaptured in M2; see `docs/screenshots/M2-05/`.                                                                                                                            | Yes                                                              |

## What shipped

29 of 31 tasks are done:

- **Jar logic:** jar library, the `ensure_jar` RPC, midnight rollover, the travel rule and the time zone banner.
- **Offline capture:** the SQLite queue, the upload worker with backoff and offline retry (D-23, D-24), and the image pipeline (1440×1920 + 480×640 WebP, location EXIF stripped).
- **Capture screens:** Today with every tile state, Camera, Camera access off with the gallery picker, Crop, and the editor (Skia colour filters, caption, privacy, stickers, bubbles, text, and edits saved as JSON and restored on reopen).
- **Stickers and moderation:** the sticker catalog with free packs and public sticker art (D-25), and `fn:moderate` auto-approving (D-22) with the Checking and Removed states.
- **Moment management:** Replace and refilling a removed slot (D-27), and Moment options (edit caption, stickers and filters, re-crop, private, move, delete with a confirmation).
- **My days and milestones:** `month_jars` and the My days calendar, Fill a past day with the server-set backfill flag, the milestones trigger, the Full jar and Sticker unlocked screens, and the Maestro offline loop.

**Tests:** 83 Jest suites, plus 8 integration suites against local Supabase. 906 pgTAP tests, covering owner, reader, outsider and blocked user for every RLS change. 26 Edge Function tests.

**Requirement IDs satisfied:** FR-CAP-01 to FR-CAP-11, FR-DAY-01, FR-DAY-02, FR-JAR-01 to FR-JAR-08, FR-PRV-01, FR-PUB-07, FR-STK-01 to FR-STK-05, NFR-A11Y-02, NFR-OFF-01 to NFR-OFF-03, NFR-PERF-02.

FR-SAF-03 and FR-SAF-04 are partly covered. The pipeline and states are built, but `fn:moderate` auto-approves until the full check returns before public launch (D-22).

### How uploaded moments are edited (M2-23)

- **Still in the queue:** edits are applied to the queued row. A photo that is mid-upload refuses with "busy" and can be edited a moment later.
- **Already uploaded:** privacy and slot moves are plain owner updates (RLS and triggers enforce them). New caption, edits and re-crop are stored as pending changes and only go live through `fn:moderate`, so nothing new goes public unchecked.
- **Re-crop:** works on the saved 3:4 photo, because the original may no longer be on the phone. You can zoom in, but not out past the last crop.

## What slipped and why

- **M2-20 second opinion and child-safety match (#49):** deferred by D-22 until before public launch.
- **M2-31 usability test (#60):** needs 10 real people; not done.
- **Android captures:** missing (D-15).

## Follow-ups

- **Crop on 6.3" phones:** the Next: edit button is below the fold. The Maestro flows scroll to reach it.
- **Stale flows fixed here:** camera, crop, fill-past-day, full-jar and timezone-banner predated the editor or the new copy. New flows: `editor-tools.yaml` and `replace-dialog.yaml`. After a fresh `db:reset`, these pass: camera (with an empty `SLOT`), crop, editor-tools, replace-dialog and fill-past-day. full-jar and timezone-banner need prepared state (7 of 8 slots on a fresh install, and a jar in another zone), so their captures come from prepared runs.
- **Flow independence:** several flows depend on the slots that earlier flows filled. A Maestro setup step that seeds each flow's jar would let them run in any order.

## Decisions made during M2

D-23 expo-network · D-24 offline time doesn't use up retries · D-25 sticker art is public catalog data · D-26 expo-image-picker · D-27 a removed photo's slot can be filled again. See `docs/decisions.md`.

## Next: the first three M3 issues

- #62 M3-01 Publish review (FR-PUB-01, FR-PUB-03)
- #63 M3-02 Today published state and visibility menu (FR-PUB-04, FR-PUB-03)
- #64 M3-03 Feed RPC (FR-SOC-01)

M3 starts only after jofftiquez approves this report.
