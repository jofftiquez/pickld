# Pickld 2.0 — Task backlog

Build top to bottom. Each task lists the requirement IDs it satisfies (see the Functional Requirements doc), what "done" means, and what it depends on. Check a box only when the Definition of Done in `AGENTS.md` is met.

Legend: **[A]** app · **[B]** backend & safety · **[W]** web · **[D]** design/content

---

## Phase 1 · Foundations (weeks 1–2)

- [ ] **T-001 [A] Expo app scaffold.** Expo Router, TypeScript strict, NativeWind wired to `src/theme/tokens.ts`, Plus Jakarta Sans loaded, Sentry + PostHog initialized, i18n with `en.json`. _Done:_ app boots to a placeholder Today on iOS and Android.
- [ ] **T-002 [A] Component kit + gallery screen.** PrimaryButton, SecondaryButton, DangerButton, PillButton, RoundIconButton (light/glass), Chip, Card, ListRow, Toggle, SegmentedControl, TextField, Avatar, JarGraphic (0–8 layers, lid color, animated), MomentTile (filled/empty/now), PhotoTile, BottomSheet, Dialog, FloatingTabBar. _Done:_ `/dev/gallery` shows all states; each matches Hi-fi A. _FR:_ NFR-A11Y-01..03.
- [ ] **T-003 [B] Supabase projects.** dev, staging, prod in Singapore; apply `0001_init.sql`; generate types. _Done:_ migrations run cleanly on all three.
- [ ] **T-004 [B] RLS test suite.** pgTAP tests for jars, moments, comments, reactions, follows, blocks as owner, reader, outsider, blocked user, moderator. _Done:_ CI fails on any visibility leak. _FR:_ FR-PUB-02, FR-PUB-05, FR-PUB-06, NFR-SEC-01.
- [ ] **T-005 [B] Auth.** Apple, Google, email magic link; deep link back into app. _FR:_ FR-ACC-01, FR-ACC-02.
- [ ] **T-006 [B] R2 + CDN setup.** Buckets per environment, Cloudflare CDN, image resizing, CSAM Scanning Tool enabled. _Done:_ a test upload is served resized from the CDN.
- [ ] **T-007 [B] Start vendor paperwork.** OpenAI account + DPA, Cloudflare CSAM tool, Apple/Google developer accounts. _Owner:_ founders.
- [ ] **T-008 [D] Content.** Final copy in `en.json`, icon (Classic mark) and splash exports, Terms/Privacy/Guidelines drafts.

## Phase 2 · Core loop (weeks 3–6)

- [ ] **T-101 [A] Jar logic library.** `src/lib/jars.ts`: open-jar lookup, travel rule, current slot, local date in zone. Unit tests for midnight, DST, date line, travel. _FR:_ FR-JAR-04, FR-JAR-05.
- [ ] **T-102 [A] Today screen.** Header, jar card with JarGraphic, 8-slot grid with all tile states, Now tile, empty first day. _FR:_ FR-JAR-01, FR-JAR-02. _Depends:_ T-002, T-101.
- [ ] **T-103 [A] Offline queue.** expo-sqlite queue, photo copy into app storage, background upload with backoff (1s, 5s, 30s, 2m, 10m), tile states Waiting / Uploading / Didn't upload + Retry. _FR:_ NFR-OFF-01, NFR-OFF-02.
- [ ] **T-104 [B] Upload function.** `fn: upload-url` returns signed PUT URLs for photo + thumb; validates ownership and slot. _Depends:_ T-006.
- [ ] **T-105 [B] Moderation function.** `fn: moderate`: on new moment, call OpenAI `omni-moderation-latest` with thumbnail + caption; thresholds → live / hidden + `moderation_items` / removed; borderline → vision-AI second opinion stored in `second_opinion`. CSAM match → block, suspend, legal flow. _FR:_ FR-SAF-03, FR-SAF-04, FR-PUB-07.
- [ ] **T-106 [A] Camera.** vision-camera 4:3, grid, flash, flip, slot switcher, gallery shortcut, permission-off state. _FR:_ FR-CAP-01, FR-CAP-11.
- [ ] **T-107 [A] Crop.** 3:4 frame, gestures, rotate, flip, fit, reset; output 1440×1920 + 480×640 WebP; strip location EXIF. _FR:_ FR-CAP-02, FR-CAP-03, FR-PRV-01.
- [ ] **T-108 [A] Editor: filters + caption + privacy.** Skia color filters with live preview; caption; private switch; save to queue. _FR:_ FR-CAP-04, FR-CAP-09.
- [ ] **T-109 [A] Editor: stickers, bubbles, text.** Gesture transforms; edits stored as JSON; reopen restores. _FR:_ FR-CAP-05..08. _Risk:_ if late, ship stickers only and follow up with bubbles/text.
- [ ] **T-110 [B] Sticker catalog + free packs.** Seed Everyday, The Eight, Stamps, Milestones; asset upload; slot hints. _FR:_ FR-STK-01..03.
- [ ] **T-111 [A] Moment options.** Edit, re-crop, private, move slot, delete. _FR:_ FR-CAP-10, FR-JAR-03.
- [ ] **T-112 [A] My days.** Month calendar with covers and fill bars; select past day; Fill this jar. _FR:_ FR-DAY-01, FR-DAY-02, FR-JAR-06.
- [ ] **T-113 [A] Full jar celebration + milestones.** Trigger-granted milestones; Sticker unlocked screen. _FR:_ FR-JAR-07, FR-STK-05.
- [ ] **T-114 [D] Usability test** of the loop with 10 people; file issues.

## Phase 3 · Social and safety (weeks 7–8)

- [ ] **T-201 [A] Publish review + visibility.** _FR:_ FR-PUB-01, FR-PUB-03, FR-PUB-04.
- [ ] **T-202 [A] Jars feed + empty state.** Cursor pagination, pull to refresh, new-jar rings. _FR:_ FR-SOC-01, FR-SOC-02.
- [ ] **T-203 [A] Jar page + Moment detail.** _FR:_ FR-SOC-03, FR-SOC-04.
- [ ] **T-204 [A] Likes + comments.** Comment text through `fn: moderate`. _FR:_ FR-SOC-05, FR-SOC-06.
- [ ] **T-205 [A] Profiles, follow, readers/authors, edit profile.** _FR:_ FR-SOC-07..09, FR-SOC-11, FR-ACC-03.
- [ ] **T-206 [B] Push pipeline.** Notification triggers → webhook → `fn: send-push` with batching, receipts, quiet hours, per-type opt-out. _FR:_ FR-NOT-02, FR-NOT-04.
- [ ] **T-207 [A] Local reminders + Notifications screen.** _FR:_ FR-NOT-01, FR-NOT-03.
- [ ] **T-208 [A] Report, block, blocked accounts.** _FR:_ FR-SAF-01, FR-SAF-02.
- [ ] **T-209 [W] Moderation console v1.** Queue, filters, blurred photos, decisions with shortcuts, audit log, appeals. _FR:_ FR-MOD-01..05, FR-SAF-05, FR-SAF-06.
- [ ] **T-210 [D] Community guidelines + moderation playbook.**

## Phase 4 · Onboarding and sharing (weeks 9–10)

- [ ] **T-301 [A] Onboarding flow.** Welcome, intro ×3, Sign up/in, Check email, About you, Under 13, Your day, Your people, Pick your jar, Permissions, Find friends, Promise, First moment tip, resume. _FR:_ FR-ACC-03..05, FR-ONB-01..09.
- [ ] **T-302 [A] Share jar card.** Skia-rendered 9:16 export; share sheet. _FR:_ FR-SOC-10.
- [ ] **T-303 [W] Shared-link site.** pickld.me/username and jar pages, OG images, store buttons, universal/app links. _FR:_ FR-WEB-01..03.
- [ ] **T-304 [A] Settings, help, delete account.** _FR:_ FR-SET-01, FR-SET-02, FR-PRV-03, FR-PRV-04.
- [ ] **T-305 [B] Data export + deletion jobs.** _FR:_ FR-PRV-02, FR-PRV-03.
- [ ] **T-306 [B] Monitoring + alerts.** _FR:_ NFR-REL-01.
- [ ] **T-307 [A] Time zone banner + upload/offline states polish.** _FR:_ FR-JAR-05, NFR-OFF-03.
- [ ] **T-308 [D] Store screenshots, Filipino copy pass, beta recruiting.**

## Phase 5 · Beta and launch (weeks 11–12)

- [ ] **T-401 [A] Accessibility pass.** Labels, hit areas, 200% text, Reduce Motion. _FR:_ NFR-A11Y-01..04.
- [ ] **T-402 [A] Performance pass.** _FR:_ NFR-PERF-01, NFR-PERF-02.
- [ ] **T-403 [B] Load test, backup restore test, threshold tuning.** _FR:_ NFR-REL-02.
- [ ] **T-404 [B] Analytics events verified.** _FR:_ NFR-ANL-01.
- [ ] **T-405 [A] Store submission** (beta build by week 10, release by week 12).
- [ ] **T-406 [D] Relaunch announcement** on the old Facebook and X pages; support inbox live.

## After launch (P1)

- [ ] **T-501 [A][B] Sticker shop, pack preview, purchases (RevenueCat), My stickers.** _FR:_ FR-STK-06..08.
- [ ] **T-502 [A] Home screen widgets.** _FR:_ FR-WID-01.
- [ ] **T-503 [A] Memories.** _FR:_ FR-DAY-03.
- [ ] **T-504 [A] Explore + search.** _FR:_ FR-EXP-01, FR-EXP-02.
- [ ] **T-505 [B] Cost review:** consider Backblaze B2 behind Cloudflare once photo costs pass ~$100/month.
- [x] **T-506 [A][B][C] Fewer word stickers, more cute picture stickers** (#270): retire about half the word stickers in each themed pack and add 64 picture stickers (animals, fruits, food and things) in the Pickld style, free and paid packs alike; prices, tiers and free packs unchanged. _FR:_ FR-STK-02, FR-STK-04.
- [x] **T-507 [A][B][C] Ten or more stickers per pack, and new packs** (#277): Stamps and Milestones to 10 (four plain stamps, five new milestones), eight more Pinoy Life pictures, and seven new premium packs: Olivia (16 pictures of the product owner's white cat), Fish Moods (16), and word-art packs Corporate, Gen Z, Trentahin, Pride and Cyclists (12 each). Existing prices, tiers and free packs unchanged. _FR:_ FR-STK-02, FR-STK-05, FR-STK-06.
- [x] **T-508 [B] Finished photos in the data export** (#279): keep the original photos and add a finished copy of each moment with its filter, stickers, bubbles and text drawn on, like the moment detail (D-45). _FR:_ FR-PRV-02.
- [x] **T-511 [A][B][C] Styled word-art lettering and a Hashtags pack** (#283): the five word-art packs move from flat pills to styled lettering (one look per pack: display font, gradient or striped fill, outline, 3D depth, small decoration, white die-cut edge) under new `-v2` art and rows, with the pills retired; a new premium Hashtags pack of 16 Pinoy hashtags in speech bubbles. _FR:_ FR-STK-02, FR-STK-05.
