# Pickld 2.0 — Task backlog

Build top to bottom. Each task lists the requirement IDs it satisfies (see the Functional Requirements doc), what "done" means, and what it depends on. Check a box only when the Definition of Done in `AGENTS.md` is met.

Legend: **[A]** app · **[B]** backend & safety · **[W]** web · **[D]** design/content

---

## Phase 1 · Foundations (weeks 1–2)

- [ ] **T-001 [A] Expo app scaffold.** Expo Router, TypeScript strict, NativeWind wired to `src/theme/tokens.ts`, Plus Jakarta Sans loaded, Sentry + PostHog initialized, i18n with `en.json`. *Done:* app boots to a placeholder Today on iOS and Android.
- [ ] **T-002 [A] Component kit + gallery screen.** PrimaryButton, SecondaryButton, DangerButton, PillButton, RoundIconButton (light/glass), Chip, Card, ListRow, Toggle, SegmentedControl, TextField, Avatar, JarGraphic (0–8 layers, lid color, animated), MomentTile (filled/empty/now), PhotoTile, BottomSheet, Dialog, FloatingTabBar. *Done:* `/dev/gallery` shows all states; each matches Hi-fi A. *FR:* NFR-A11Y-01..03.
- [ ] **T-003 [B] Supabase projects.** dev, staging, prod in Singapore; apply `0001_init.sql`; generate types. *Done:* migrations run cleanly on all three.
- [ ] **T-004 [B] RLS test suite.** pgTAP tests for jars, moments, comments, reactions, follows, blocks as owner, reader, outsider, blocked user, moderator. *Done:* CI fails on any visibility leak. *FR:* FR-PUB-02, FR-PUB-05, FR-PUB-06, NFR-SEC-01.
- [ ] **T-005 [B] Auth.** Apple, Google, email magic link; deep link back into app. *FR:* FR-ACC-01, FR-ACC-02.
- [ ] **T-006 [B] R2 + CDN setup.** Buckets per environment, Cloudflare CDN, image resizing, CSAM Scanning Tool enabled. *Done:* a test upload is served resized from the CDN.
- [ ] **T-007 [B] Start vendor paperwork.** OpenAI account + DPA, Cloudflare CSAM tool, Apple/Google developer accounts. *Owner:* founders.
- [ ] **T-008 [D] Content.** Final copy in `en.json`, icon (Classic mark) and splash exports, Terms/Privacy/Guidelines drafts.

## Phase 2 · Core loop (weeks 3–6)

- [ ] **T-101 [A] Jar logic library.** `src/lib/jars.ts`: open-jar lookup, travel rule, current slot, local date in zone. Unit tests for midnight, DST, date line, travel. *FR:* FR-JAR-04, FR-JAR-05.
- [ ] **T-102 [A] Today screen.** Header, jar card with JarGraphic, 8-slot grid with all tile states, Now tile, empty first day. *FR:* FR-JAR-01, FR-JAR-02. *Depends:* T-002, T-101.
- [ ] **T-103 [A] Offline queue.** expo-sqlite queue, photo copy into app storage, background upload with backoff (1s, 5s, 30s, 2m, 10m), tile states Waiting / Uploading / Didn't upload + Retry. *FR:* NFR-OFF-01, NFR-OFF-02.
- [ ] **T-104 [B] Upload function.** `fn: upload-url` returns signed PUT URLs for photo + thumb; validates ownership and slot. *Depends:* T-006.
- [ ] **T-105 [B] Moderation function.** `fn: moderate`: on new moment, call OpenAI `omni-moderation-latest` with thumbnail + caption; thresholds → live / hidden + `moderation_items` / removed; borderline → vision-AI second opinion stored in `second_opinion`. CSAM match → block, suspend, legal flow. *FR:* FR-SAF-03, FR-SAF-04, FR-PUB-07.
- [ ] **T-106 [A] Camera.** vision-camera 4:3, grid, flash, flip, slot switcher, gallery shortcut, permission-off state. *FR:* FR-CAP-01, FR-CAP-11.
- [ ] **T-107 [A] Crop.** 3:4 frame, gestures, rotate, flip, fit, reset; output 1440×1920 + 480×640 WebP; strip location EXIF. *FR:* FR-CAP-02, FR-CAP-03, FR-PRV-01.
- [ ] **T-108 [A] Editor: filters + caption + privacy.** Skia color filters with live preview; caption; private switch; save to queue. *FR:* FR-CAP-04, FR-CAP-09.
- [ ] **T-109 [A] Editor: stickers, bubbles, text.** Gesture transforms; edits stored as JSON; reopen restores. *FR:* FR-CAP-05..08. *Risk:* if late, ship stickers only and follow up with bubbles/text.
- [ ] **T-110 [B] Sticker catalog + free packs.** Seed Everyday, The Eight, Stamps, Milestones; asset upload; slot hints. *FR:* FR-STK-01..03.
- [ ] **T-111 [A] Moment options.** Edit, re-crop, private, move slot, delete. *FR:* FR-CAP-10, FR-JAR-03.
- [ ] **T-112 [A] My days.** Month calendar with covers and fill bars; select past day; Fill this jar. *FR:* FR-DAY-01, FR-DAY-02, FR-JAR-06.
- [ ] **T-113 [A] Full jar celebration + milestones.** Trigger-granted milestones; Sticker unlocked screen. *FR:* FR-JAR-07, FR-STK-05.
- [ ] **T-114 [D] Usability test** of the loop with 10 people; file issues.

## Phase 3 · Social and safety (weeks 7–8)

- [ ] **T-201 [A] Publish review + visibility.** *FR:* FR-PUB-01, FR-PUB-03, FR-PUB-04.
- [ ] **T-202 [A] Jars feed + empty state.** Cursor pagination, pull to refresh, new-jar rings. *FR:* FR-SOC-01, FR-SOC-02.
- [ ] **T-203 [A] Jar page + Moment detail.** *FR:* FR-SOC-03, FR-SOC-04.
- [ ] **T-204 [A] Likes + comments.** Comment text through `fn: moderate`. *FR:* FR-SOC-05, FR-SOC-06.
- [ ] **T-205 [A] Profiles, follow, readers/authors, edit profile.** *FR:* FR-SOC-07..09, FR-SOC-11, FR-ACC-03.
- [ ] **T-206 [B] Push pipeline.** Notification triggers → webhook → `fn: send-push` with batching, receipts, quiet hours, per-type opt-out. *FR:* FR-NOT-02, FR-NOT-04.
- [ ] **T-207 [A] Local reminders + Notifications screen.** *FR:* FR-NOT-01, FR-NOT-03.
- [ ] **T-208 [A] Report, block, blocked accounts.** *FR:* FR-SAF-01, FR-SAF-02.
- [ ] **T-209 [W] Moderation console v1.** Queue, filters, blurred photos, decisions with shortcuts, audit log, appeals. *FR:* FR-MOD-01..05, FR-SAF-05, FR-SAF-06.
- [ ] **T-210 [D] Community guidelines + moderation playbook.**

## Phase 4 · Onboarding and sharing (weeks 9–10)

- [ ] **T-301 [A] Onboarding flow.** Welcome, intro ×3, Sign up/in, Check email, About you, Under 13, Your day, Your people, Pick your jar, Permissions, Find friends, Promise, First moment tip, resume. *FR:* FR-ACC-03..05, FR-ONB-01..09.
- [ ] **T-302 [A] Share jar card.** Skia-rendered 9:16 export; share sheet. *FR:* FR-SOC-10.
- [ ] **T-303 [W] Shared-link site.** pickld.me/username and jar pages, OG images, store buttons, universal/app links. *FR:* FR-WEB-01..03.
- [ ] **T-304 [A] Settings, help, delete account.** *FR:* FR-SET-01, FR-SET-02, FR-PRV-03, FR-PRV-04.
- [ ] **T-305 [B] Data export + deletion jobs.** *FR:* FR-PRV-02, FR-PRV-03.
- [ ] **T-306 [B] Monitoring + alerts.** *FR:* NFR-REL-01.
- [ ] **T-307 [A] Time zone banner + upload/offline states polish.** *FR:* FR-JAR-05, NFR-OFF-03.
- [ ] **T-308 [D] Store screenshots, Filipino copy pass, beta recruiting.**

## Phase 5 · Beta and launch (weeks 11–12)

- [ ] **T-401 [A] Accessibility pass.** Labels, hit areas, 200% text, Reduce Motion. *FR:* NFR-A11Y-01..04.
- [ ] **T-402 [A] Performance pass.** *FR:* NFR-PERF-01, NFR-PERF-02.
- [ ] **T-403 [B] Load test, backup restore test, threshold tuning.** *FR:* NFR-REL-02.
- [ ] **T-404 [B] Analytics events verified.** *FR:* NFR-ANL-01.
- [ ] **T-405 [A] Store submission** (beta build by week 10, release by week 12).
- [ ] **T-406 [D] Relaunch announcement** on the old Facebook and X pages; support inbox live.

## After launch (P1)

- [ ] **T-501 [A][B] Sticker shop, pack preview, purchases (RevenueCat), My stickers.** *FR:* FR-STK-06..08.
- [ ] **T-502 [A] Home screen widgets.** *FR:* FR-WID-01.
- [ ] **T-503 [A] Memories.** *FR:* FR-DAY-03.
- [ ] **T-504 [A] Explore + search.** *FR:* FR-EXP-01, FR-EXP-02.
- [ ] **T-505 [B] Cost review:** consider Backblaze B2 behind Cloudflare once photo costs pass ~$100/month.
