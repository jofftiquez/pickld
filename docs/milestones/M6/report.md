# M6 Post-launch report

Nov 13, 2026. Summary of M6 (P1), built overnight on jofftiquez's Mac runner. iOS captures come from the iPhone 17 Pro Simulator (iOS 27.2), at normal text size. Each screen's design and iOS capture are in `docs/milestones/M6/<Screen>-design.png` and `<Screen>-ios.png`, and went to the Space when that PR merged.

**No Android captures or runs.** jofftiquez asked for iOS only to save resources.

## Per task

| Task                              | Issue | State                                   | Evidence                                                                                                                                                                                                                                       |
| --------------------------------- | ----- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M6-01 RevenueCat webhook 🔑       | #125  | Done, #260; live setup is the founders' | `fn:revenuecat-webhook` checks the dashboard secret, then reads verified purchases from RevenueCat's REST API and syncs `owned_packs` (0028, D-40). pgTAP 028 (16), Deno tests with webhook fixtures; unlock in about 10 ms (target 5 s)       |
| M6-02 Sticker shop                | #126  | Done, #261                              | Migration 0029 (pack descriptions, 5 paid packs, 76 stickers). Shop with seasonal banner, For you, Yours, search; locked tabs in the Stickers tool (reverses D-6). `StickerShop-ios.png`, `Stickers-ios.png`, `Stickers-locked-ios.png`        |
| M6-03 Pack preview and purchase   | #127  | Done, #262; real purchases wait on keys | Pack preview to the design; RevenueCat when `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is set, the dev store locally; `fn: store-sync`. A dev purchase unlocked the Pinoy Life tab on the Simulator. `PackPreview-ios.png`, `PackPreview-bought-ios.png` |
| M6-04 My stickers                 | #128  | Done, #263                              | Reorder, hide, Restore purchases; saved to `user_pack_prefs`, followed by the editor. `MyStickers-ios.png`                                                                                                                                     |
| M6-05 Memories RPCs               | #129  | Done, #264                              | `memories_on_this_day`, `memories_month_recap`, `memories_year_summary` (0030, owner-only). pgTAP 030 (22)                                                                                                                                     |
| M6-06 Memories screen             | #130  | Done, #265                              | `/memories` from My days. `Memories-ios.png`                                                                                                                                                                                                   |
| M6-07 Search and suggestions RPCs | #131  | Done, #266                              | `search_people`, `suggested_authors`, `full_jars_today` (0031). pgTAP 031 (22)                                                                                                                                                                 |
| M6-08 Explore screen              | #132  | Done, #267                              | `/explore`; Jars-empty Find people opens it. Jest (7), Maestro `explore.yaml` passes. `Explore-ios.png`                                                                                                                                        |
| M6-09 Widget shared storage       | #133  | Done, #268                              | App Group `group.me.pickld.app`; Today writes the jar timeline on every filled slot (offline too); the friend photo is copied into the App Group folder                                                                                        |
| M6-10 iOS widgets                 | #134  | Done, #268                              | Today (medium) and Friend (small) placed on the Simulator home screen with live data; deep links to Today, Camera and the friend's moment tapped and checked. `Widgets-ios.png`                                                                |
| M6-11 Android widgets             | #135  | **Not done**                            | Skipped: iOS only by request                                                                                                                                                                                                                   |
| M6-12 Photo storage cost review   | #136  | Done, #269                              | `docs/photo-storage-costs.md`: stay on R2; at about $100 a month B2 behind Cloudflare would cost about $46 against $108                                                                                                                        |

## Differences from the design, and fixes

- **Explore:** suggestion subtitles say "Read by N friends" instead of "Reads 4 friends", because friends-of-friends means who reads them.
- **Memories:** the title is the weekday ("Your Thursday"); the design's "Your Monday with the cousins" has no data source. The top tag is the month's most-filled slot, since Pickld's hashtags are slot names.
- **Widgets, fixed before merge:** the jar had no outline and the text was cut off; the camera button opened Today (only one `widgetURL` applies per widget, so it's now a `Link`); the friend photo never reached the widget (a doubled `file://` prefix, and the native side rejects null props). All four were found on the Simulator and fixed.
- **Tests:** the `full_jars_today` test depended on row order; fixed in #266.

## Not done

- **M6-11 Android widgets** (iOS only).
- **Real purchases:** sandbox and the dev store only. They need RevenueCat and App Store accounts and keys (`docs/runbooks/revenuecat.md`).
- **Widgets on a device or TestFlight:** the App Group `group.me.pickld.app` and the widget target `me.pickld.app.widgets` must exist in the Apple Developer account. EAS creates them if it manages credentials; the Simulator needs no signing.
- The widgets' empty-jar first-run look wasn't seen on a clean install (a reinstall signs the test user out).
- No Android captures for any M6 screen.

**Tests:** 142 Jest suites (1428 tests) pass locally apart from the two TimeZoneBanner suites, which fail on macOS's case-insensitive file system and pass in CI; the full pgTAP suite (1417) passes. CI is green on every M6 PR.

**Requirement IDs satisfied:** FR-STK-06, FR-STK-07 (sandbox), FR-STK-08, FR-DAY-03, FR-EXP-01, FR-WID-01 (iOS).

## Founder tasks (new in M6)

- RevenueCat project, App Store products and the webhook secret (`docs/runbooks/revenuecat.md`), then a sandbox purchase on a real iPhone.
- App Group and widget target in the Apple Developer account (or let EAS manage them), then check both widgets on a real iPhone.
- Everything carried over from M5 still stands (`docs/milestones/M5/report.md`).

## Next

M6 is the last milestone in `docs/plan.md`. Moderation for "Before public launch" stays parked (D-22).
