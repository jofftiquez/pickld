# M5-08 · Release candidate regression (Maestro)

Ran on 2026-11-12 against main after #257 plus this PR's fixes, on the iPhone 17 Pro Simulator (iOS 27.2) against the local stack. The flows use the dev-only routes (`/dev/sign-in`, the mock camera, the offline switch), which release builds ignore, so the run uses the **Debug** build of the same code. Android isn't covered: there is no emulator (D-15).

The groups were ordered so each flow starts from the state its header asks for. The database is reset (`pnpm db:reset` plus the photo seed) and the app reinstalled before each group that changes data.

| Group | Setup | Flows | Result |
| --- | --- | --- | --- |
| 1 | Fresh seed, dale | tab-switch, today, my-days, moment-states, jars-feed, jar-page, moment-detail, comments, profiles, readers, edit-profile, notifications, report, share-card, moment-options, replace-dialog, gallery, camera-denied, reminders, publish-review, today-published, block | 22 pass (reminders after its fix) |
| 2 | Reset, dale | camera (`SLOT=whoamiwith`), editor-tools, crop, full-jar | 4 pass |
| 3 | Reset, dale | offline-loop (`SLOT=evening`), fill-past-day, moment-options-apply | 3 pass (offline-loop after the app fix) |
| 4 | lola, then signed out | jars-empty, onboarding, sign-in-email, about-under13, onboarding-full | 5 pass (two after their fix) |
| 5 | dale, AX3 text | large-text | pass |
| 6 | dale, Tokyo jar after a Manila one, Simulator in Tokyo time | timezone-banner | pass |

**36 of 36 flows pass.** `capture-route.yaml` is the screenshot helper for `scripts/capture.sh`, not a test.

## Found and fixed

- **A photo taken right after flying west never uploaded (app bug, FR-JAR-04).** When a photo joins the open jar (travel rule), the queue row took the jar's date but the **phone's** zone. After flying west the open jar's date can be ahead of the phone's (Manila's 13th while the phone is still on the 12th), and `ensure_jar` refuses a date that is still in the future in the zone it is given. After 5 attempts the photo showed Didn't upload. Now a photo that joins an existing jar keeps that jar's zone, in both the camera and gallery paths (`captureJarDate`). The unit test had pinned the old pairing; it now checks the zone too, and fails on the old code. `offline-loop` hit this because the database was reset just after Manila's midnight while the Simulator ran on UTC. The rerun in the same situation uploaded the photo into the 13th's Manila jar, and it went live.
- **sign-in-email, about-under13:** M5-01 made the email field's return key Send, which Maestro's `hideKeyboard` can't use on iOS. The flows now tap the screen title instead, as other flows already do.
- **reminders:** iOS can answer the notification prompt between Maestro seeing it and tapping it, so that tap is now optional.
