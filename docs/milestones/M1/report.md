# M1 Foundations report

Nov 11, 2026. Summary issue #29. iOS captures come from the iPhone 17 Pro Simulator (iOS 27.0). Design captures come from `design/screens/*.html` through `scripts/capture-design.mjs`. Re-run them with `scripts/capture.sh M1 Main=today apps/mobile/.maestro/gallery.yaml`.

**Android captures are missing.** The orb and its Mac satellite can't run an Android emulator (D-15). The containers section has Android captures in `docs/screenshots/M1-20/` from the Mac runner.

## Screens compared with the design

| Screen | Files | Difference from the design | Intended? |
| --- | --- | --- | --- |
| Splash | `Splash-design.png`, `Splash-ios.png` | Native splash shows the logo on brand green. The tagline and the 8-square loader appear in the JS overlay that follows it (see `docs/screenshots/M1-25/`). | Yes: iOS native splashes can't animate |
| AppIcon | `AppIcon-design.png`, `AppIcon-ios.png` | Matches; iOS applies its own corner mask. | Yes |
| Main (Today) | `Main-design.png`, `Main-ios.png` | Only the tab bar is built. The jar card, the tiles and the header land in M2-05. The bar sits at the safe-area inset (about 34 pt) instead of 16 px from the bottom, and its blur only approximates `blur(18px)`. | Yes (M1 scope) |
| JarLid / FullJar (JarGraphic) | `JarLid-design.png`, `FullJar-design.png`, `Gallery-jar-ios.png` | Matches the 48×60 jar for layers 0–8, every lid colour, and the on-dark variant. | Yes |
| UploadStates / Story (MomentTile) | `UploadStates-design.png`, `Gallery-tiles-ios.png` | Pills are inset 8 pt (the design uses 9 to 12). The time pill has no backdrop blur. The Checking state and the private lock have no design, so their look is my choice. | Yes, open to review |
| Kit: buttons, forms, containers | `Gallery-buttons-ios.png`, `Gallery-forms-ios.png`, `Gallery-sheet-ios.png`, `Gallery-dialog-ios.png` | No dedicated design screen exists. Styles are taken from the screens that use each control. | Yes |

## What shipped

26 of 28 tasks are done. The work covers:
- **App:** the Expo scaffold, fonts, i18n and lint guards; CI; the app Supabase client; the Sentry and PostHog wrapper; the full component kit (buttons, form controls, containers, JarGraphic, MomentTile and PhotoTile); the floating tab bar and tab shell; the app icon and splash; and the dev gallery with screenshot tooling.
- **Backend:** local Supabase with seed data and generated types; migrations 0002–0007 hardening profiles, jars, moments and social tables; a 631-test pgTAP suite, including the full RLS matrix; the photo worker; and the `upload-url` and `photo-urls` Edge Functions.
- **Safety:** a CSAM scanning review (`docs/csam-scanning.md`).

**Requirement IDs covered:** FR-ACC-05, FR-CAP-10, FR-JAR-01, FR-JAR-02, FR-JAR-03, FR-JAR-04, FR-JAR-05, FR-JAR-06, FR-JAR-07, FR-JAR-08, FR-MOD-03, FR-ONB-04, FR-PUB-02, FR-PUB-03, FR-PUB-05, FR-PUB-06, FR-PUB-07, FR-SAF-06, FR-SOC-05, FR-SOC-06, NFR-A11Y-01, NFR-A11Y-02, NFR-A11Y-03, NFR-A11Y-04, NFR-ANL-01, NFR-I18N-01, NFR-OFF-03, NFR-SEC-01, NFR-SEC-02. These are covered at the foundation level the M1 tasks define. The user-facing FR-JAR behaviour completes in M2.

FR-ACC-02 and NFR-REL-01 are partly covered: the session client and the monitoring wrapper are built, but live provider sign-in and live event sending are unverified because there are no keys.

## What slipped and why

- **M1-01 Vendor accounts (#1) and M1-27 Legal drafts (#27):** these are founder tasks and are still open.
- **M1-12 Auth providers (#12):** blocked. It needs the Apple Sign in key, Services ID and team ID, plus the Google OAuth client IDs.
- **M1-28 Staging and production pipeline (#28):** blocked. It needs Supabase staging and production projects (Singapore), Cloudflare, Vercel and the CI deploy secrets.
- **FR-SAF-04:** not satisfied. Cloudflare's tool can't act as the automatic gate (decision 1 below).
- **Android captures:** missing; see the top of this report.

## Decisions for jofftiquez

1. **PhotoDNA:** approve applying for the Microsoft PhotoDNA Cloud Service. It is free for vetted organizations. Cloudflare's CSAM tool has no API and only scans cached images, so it can only be a backstop. Paid fallbacks (Thorn Safer, Hive) would need your approval.
2. **CSAM email:** name who reads Cloudflare's daily CSAM detection email, and confirm the tool is a backstop only.
3. **Founder-owned settings still missing:** R2 buckets and tokens, `PHOTO_TOKEN_SECRET`, `SENTRY_DSN`, and the photos domain (for example photos.pickld.me).

**Backend follow-ups (later milestones):**
- Signed-in users can still call `is_blocked_between`.
- Owners can delete removed moments, which loses evidence. This belongs with M3-23.

## Next: the first three M2 issues

- #30 M2-01 Jar logic library (FR-JAR-02, FR-JAR-04, FR-JAR-05)
- #31 M2-02 `ensure_jar` RPC (FR-JAR-04, FR-JAR-05)
- #32 M2-03 Offline queue core (NFR-OFF-01, NFR-OFF-02)

M2 starts only after jofftiquez approves this report.
