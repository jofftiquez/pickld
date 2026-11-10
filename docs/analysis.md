# Pickld 2.0 — Phase 1 analysis

Nov 10, 2026. Sources read in full: `AGENTS.md`, `docs/requirements.md`, `docs/architecture.md`, `docs/product.md`, `docs/tasks.md`, `supabase/migrations/0001_init.sql`, `apps/mobile/src/theme/tokens.ts`, `design/index.html`, `design/preview.html` and all 64 files in `design/screens/`.

Precedence when documents conflict: `AGENTS.md` and `docs/requirements.md` win (brief, ground rules). Resolutions that need the product owner are listed under [Open decisions](#4-open-decisions-for-the-product-owner); anything left unanswered falls back to its recommended default and gets recorded in `docs/decisions.md`.

## 1. Requirements matrix

Legend:

- **Screens** use the `design/screens/<File>.html` names (the artboard title differs in a few cases: `Main` = Today, `EmptyToday` = Today, first day, `Story` = Jar, `Feed` = Jars, `EmptyStories` = Jars, empty, `Calendar` = My days, `Coach` = First moment tip, `Moment` = Moment detail, `Readers` = Readers & authors, `LockScreen` = Notification designs).
- **Tables** are Postgres tables; `+` marks a table or column that 0001 does not have yet (see §2.3).
- **Functions** are Supabase Edge Functions (`fn:`) or SQL functions and triggers (`sql:`).
- **Modules**: `f/x` = `apps/mobile/src/features/x`, `lib/x` = `apps/mobile/src/lib/x`, `kit` = `src/components`, `web` = `apps/web`, `mod` = `apps/mod`.

### Accounts and onboarding

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-ACC-01 | P0 | SignUp, CheckEmail | auth.users, profiles | Supabase Auth (Apple, Google, OTP link) | f/onboarding, lib/supabase, lib/auth |
| FR-ACC-02 | P0 | SignIn, CheckEmail | auth.users | Supabase Auth; deep link handler | f/onboarding, lib/auth, lib/links |
| FR-ACC-03 | P0 | About, EditProfile | profiles (username citext), +reserved_usernames | sql: `username_available()` (security definer), fn:moderate (text) | f/onboarding, f/profile |
| FR-ACC-04 | P0 | About, Under13 | auth.users, profiles | fn:account-purge (deletes auth user) | f/onboarding |
| FR-ACC-05 | P0 | About | profiles (avatar_path, display_name, birthday) | fn:upload-url (avatar) | f/onboarding, lib/upload |
| FR-ONB-01 | P0 | Intro1–3, Welcome | — | — | f/onboarding |
| FR-ONB-02 | P0 | QuizDay | reminder_settings, onboarding_answers.day_type | — | f/onboarding, lib/reminders |
| FR-ONB-03 | P0 | QuizPeople | onboarding_answers | — | f/onboarding |
| FR-ONB-04 | P0 | JarLid, EditProfile | profiles.lid_color | — | f/onboarding, f/profile, kit/JarGraphic |
| FR-ONB-05 | P0 | Permissions | — | — | f/onboarding, lib/permissions |
| FR-ONB-06 | P0 | FindFriends | +contact_hashes, follows | fn:contacts-match | f/onboarding, lib/contacts |
| FR-ONB-07 | P0 | Promise | onboarding_answers.promise_accepted_at, +promise_skipped_at | — | f/onboarding |
| FR-ONB-08 | P0 | Coach, EmptyToday | (local flag) | — | f/onboarding, f/jar |
| FR-ONB-09 | P0 | About … FindFriends | (local SQLite step) | — | f/onboarding, lib/storage |

### Today, jars and days

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-JAR-01 | P0 | Main, EmptyToday | jars, moments, profiles.reader_count | sql: `moments_count_sync` | f/jar, kit/JarGraphic, kit/MomentTile |
| FR-JAR-02 | P0 | Main | moments | — | f/jar, lib/jars (`currentSlot`) |
| FR-JAR-03 | P0 | Main, Camera | moments unique (jar_id, slot), +pending_photo_path | sql: insert refusal; fn:moderate (swap on live) | f/capture, lib/queue |
| FR-JAR-04 | P0 | Main, Calendar | jars (local_date, tz) | — | lib/jars, f/jar (midnight timer) |
| FR-JAR-05 | P0 | TimeZone | jars.tz, +jars.ends_at | sql: `jar_ends_at`, `moments_before_insert` | lib/jars, f/jar |
| FR-JAR-06 | P0 | Story, Calendar, Moment | moments (added_at, is_backfilled) | sql: `moments_before_insert`, move-guard | f/jar, f/feed, kit/AddedLaterBadge |
| FR-JAR-07 | P0 | FullJar | jars.is_full, milestones | sql: full-jar trigger | f/jar, lib/motion |
| FR-JAR-08 | P0 | Profile, FullJar | profiles.jar_count | sql: `moments_count_sync` | f/profile, f/jar |

### Capture, crop and editing

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-CAP-01 | P0 | Camera | — | — | f/capture (vision-camera) |
| FR-CAP-02 | P0 | Camera, Crop | jars, moments (captured_at, is_backfilled) | sql: `moments_before_insert` | f/capture, lib/jars, lib/exif |
| FR-CAP-03 | P0 | Crop | — | — | f/capture (gesture-handler, image-manipulator) |
| FR-CAP-04 | P0 | Capture | moments.edits.filter | — | f/capture/editor (Skia) |
| FR-CAP-05 | P0 | Stickers | moments.edits.stickers, stickers | — | f/capture/editor, f/stickers |
| FR-CAP-06 | P0 | Bubble | moments.edits.bubbles | — | f/capture/editor |
| FR-CAP-07 | P0 | Text | moments.edits.text | — | f/capture/editor |
| FR-CAP-08 | P0 | Capture, Stickers, Bubble, Text | moments.edits (Zod schema) | — | f/capture/editor, lib/edits |
| FR-CAP-09 | P0 | Capture | moments (caption, is_private) | fn:moderate (caption) | f/capture, lib/queue |
| FR-CAP-10 | P0 | MomentOptions, Delete-confirm dialog | moments | sql: moments update guard | f/capture, f/jar |
| FR-CAP-11 | P0 | CameraDenied | — | — | f/capture, lib/permissions |

### Publishing and visibility

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-PUB-01 | P0 | Publish | jars (visibility, published_at), profiles.default_visibility | — | f/jar/publish |
| FR-PUB-02 | P0 | all | jars, moments | sql: `can_view_jar`, RLS + pgTAP | supabase/tests |
| FR-PUB-03 | P0 | Publish, Story (menu), WebShare | jars.visibility | sql: `can_view_jar`, +`public_jar()` RPC for web | f/jar, web |
| FR-PUB-04 | P0 | TodayPublished | jars.published_at, moments.status | RLS (no extra step) | f/jar |
| FR-PUB-05 | P0 | all | moments.is_private | RLS, share-card/OG renderers, analytics filter | f/feed, f/share, web, lib/analytics |
| FR-PUB-06 | P0 | all | blocks | sql: `is_blocked_between` in every policy | supabase/tests |
| FR-PUB-07 | P0 | Checking, Removed | moments.status | fn:moderate | f/jar, f/capture |

### Jars feed, social and profiles

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-SOC-01 | P0 | Feed | jars, follows, +profiles.feed_seen_at | sql: `feed_page(cursor)` | f/feed |
| FR-SOC-02 | P0 | EmptyStories | follows, contact_hashes | fn:contacts-match | f/feed |
| FR-SOC-03 | P0 | Story | jars, moments, reactions | — | f/feed (jar page) |
| FR-SOC-04 | P0 | Moment | moments | — | f/feed (moment detail) |
| FR-SOC-05 | P0 | Story, Moment | reactions, +like_count triggers | sql: reaction counter + notification triggers | f/feed |
| FR-SOC-06 | P0 | Comments | comments, +comment_count trigger | fn:moderate (text), sql: comment guards | f/feed/comments |
| FR-SOC-07 | P0 | Profile, ProfileOther, Readers | follows | sql: `follows_sync` | f/profile |
| FR-SOC-08 | P0 | Profile, ProfileOther | public_profiles, jars, moments | — | f/profile |
| FR-SOC-09 | P0 | Readers | follows, public_profiles | sql: `search_follow_list()` | f/profile |
| FR-SOC-10 | P0 | ShareCard | jars, moments | — (Skia on device) | f/share |
| FR-SOC-11 | P0 | EditProfile | profiles | fn:upload-url, fn:moderate (text + avatar) | f/profile |

### My days, memories, explore and notifications

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-DAY-01 | P0 | Calendar | jars, moments (cover) | sql: `month_jars(month)` | f/days |
| FR-DAY-02 | P0 | Calendar, Camera | jars, moments | sql: backfill trigger | f/days, f/capture |
| FR-DAY-03 | P1 | Memories | jars, moments | sql: recap RPCs | f/memories |
| FR-EXP-01 | P1 | Explore | public_profiles, blocks | sql: `search_people()` (trigram index) | f/explore |
| FR-EXP-02 | P1 | Explore | contact_hashes, follows, jars | sql: suggestions RPC | f/explore |
| FR-NOT-01 | P0 | LockScreen, Settings | reminder_settings | — (local) | lib/reminders |
| FR-NOT-02 | P0 | LockScreen | notifications, push_tokens, +notification_prefs | sql: notification triggers; fn:send-push | lib/push |
| FR-NOT-03 | P0 | Notifications | notifications | — | f/notifications |
| FR-NOT-04 | P0 | Settings | +notification_prefs, profiles.home_tz | fn:send-push (quiet hours) | f/settings |

### Stickers

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-STK-01 | P0 | Stickers | sticker_packs, stickers (seed) | seed migration + R2 upload | f/stickers |
| FR-STK-02 | P0 | Stickers | sticker_packs, stickers | — | f/stickers, lib/cache |
| FR-STK-03 | P0 | Stickers | stickers.slot_hint, tags, onboarding_answers | — | f/stickers |
| FR-STK-04 | P0 | all | moments.edits, stickers (read for all viewers, incl. web) | +anon/web read path | f/capture/editor renderer, web |
| FR-STK-05 | P0 | StickerUnlock | milestones, owned_packs | sql: milestone trigger | f/stickers |
| FR-STK-06 | P1 | StickerShop | sticker_packs, owned_packs | — | f/stickers/shop |
| FR-STK-07 | P1 | PackPreview | owned_packs | fn:revenuecat-webhook | f/stickers/shop |
| FR-STK-08 | P1 | MyStickers | user_pack_prefs, owned_packs | RevenueCat restore | f/stickers |

### Settings, privacy and safety

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-SET-01 | P0 | Settings | profiles, reminder_settings, blocks | — | f/settings |
| FR-SET-02 | P0 | Help | — (static FAQ in i18n) | — | f/settings |
| FR-SAF-01 | P0 | Report, ReportThanks | reports, moderation_items | sql: report trigger (3-in-24h hide) | f/safety |
| FR-SAF-02 | P0 | Block, Blocked | blocks, follows | sql: `blocks_sync` | f/safety, f/settings |
| FR-SAF-03 | P0 | Checking | moments.status, moderation_items | fn:moderate (CSAM gate + OpenAI) | f/jar |
| FR-SAF-04 | P0 | — | profiles.status, +csam_incidents | fn:moderate | — |
| FR-SAF-05 | P0 | Removed, ModConsole | appeals, moderation_items, notifications | fn:mod-action | f/safety, mod |
| FR-SAF-06 | P0 | — (no design; see G-15) | +profiles.suspended_until, +strikes | fn:mod-action, sql: strike trigger | f/safety, mod |
| FR-PRV-01 | P0 | — | — | (verified in fn:moderate test) | lib/exif, f/capture |
| FR-PRV-02 | P0 | Delete | +account_jobs | fn:data-export | f/settings |
| FR-PRV-03 | P0 | Delete | profiles.status, +account_jobs | fn:account-delete + scheduled purge | f/settings |
| FR-PRV-04 | P0 | SignUp, Settings, Help | — | — (web pages on pickld.me) | f/settings, web |

### Moderation console, shared-link page and widgets

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| FR-MOD-01 | P0 | ModConsole (+access-denied, no design) | auth app_metadata.role | sql: `is_moderator` | mod |
| FR-MOD-02 | P0 | ModConsole | moderation_items, appeals | sql: queue stats view | mod |
| FR-MOD-03 | P0 | ModConsole | — | fn:photo-urls (moderator scope) | mod |
| FR-MOD-04 | P0 | ModConsole | moderation_items, moments, notifications, audit_log | fn:mod-action | mod |
| FR-MOD-05 | P0 | ModConsole | audit_log (append-only trigger) | fn:mod-action | mod |
| FR-WEB-01 | P0 | WebShare | jars, moments, public_profiles | +sql: `public_jar()`, `public_profile()` (anon) | web |
| FR-WEB-02 | P0 | WebShare | same | web OG image route | web |
| FR-WEB-03 | P0 | WebShare | — | AASA + assetlinks | web, lib/links |
| FR-WID-01 | P1 | Widgets | jars, moments | — | native widget extensions |

### Non-functional

| ID | P | Screens | Tables | Functions | Modules |
| --- | --- | --- | --- | --- | --- |
| NFR-PERF-01 | P0 | Main | — | — | app shell, lib/queryCache |
| NFR-PERF-02 | P0 | Feed, Calendar | thumb_path | — | f/feed, f/days, expo-image |
| NFR-OFF-01 | P0 | UploadStates | — | — | lib/queue, f/capture |
| NFR-OFF-02 | P0 | UploadStates | — | — | lib/queue (SQLite + file-system) |
| NFR-OFF-03 | P0 | Feed, Main, Calendar | — | — | TanStack persist (SQLite) |
| NFR-A11Y-01 | P0 | all | — | — | kit, all features |
| NFR-A11Y-02 | P0 | all | — | — | kit, lib/motion |
| NFR-A11Y-03 | P0 | all | — | — | kit (`hitSlop`) |
| NFR-A11Y-04 | P0 | all | — | — | tokens.ts |
| NFR-SEC-01 | P0 | — | all RLS tables | pgTAP suite in CI | supabase/tests |
| NFR-SEC-02 | P0 | — | — | fn:photo-urls, Cloudflare Worker token check | lib/photos, web, mod |
| NFR-REL-01 | P0 | — | moderation_items, upload metrics | Sentry, alert jobs | lib/monitoring |
| NFR-REL-02 | P0 | — | — | Supabase backups, restore drill | ops runbook |
| NFR-I18N-01 | P0 | all | — | — | src/i18n |
| NFR-ANL-01 | P0 | — | — | — | lib/analytics (PostHog) |

All 104 IDs are mapped (97 P0, 7 P1). The draft backlog in `docs/tasks.md` misses four P0 IDs: **FR-JAR-08** (jar counts), **FR-STK-04** (viewers never pay), **NFR-SEC-02** (secrets and signed photo links) and **NFR-I18N-01** (translation files). It also names FR-JAR-03 without the Replace flow and FR-SAF-06 without its UI. The Phase 2 plan will cover all of them explicitly.

## 2. Gaps, contradictions and ambiguities

### 2.1 Between the documents

| # | Finding | Proposed resolution |
| --- | --- | --- |
| G-1 | **Westward travel creates two jars on the same date.** Example: a Manila jar for Nov 10 ends at Manila midnight, which is 16:00 on Nov 10 in London. Today's jar in the phone's zone is then Nov 10 again, which hits `unique (user_id, local_date)`. The architecture covers only eastward travel. This happens on any westward trip, not only across the date line. | Add a server-set `jars.ends_at`. On a same-date collision, the server switches the open jar to the new zone and moves `ends_at` later (never earlier), so moments in those extra hours aren't badged. See D-1. |
| G-2 | **Offline capture vs. server time.** "Server time decides Added later" (AGENTS rule 6, FR-JAR-06) and "offline capture, upload when back online" (NFR-OFF-01) clash: a moment captured offline at 23:50 and uploaded at 00:10 gets "Added later". | Needs a product call because it touches FR-JAR-06's acceptance criteria. See D-2. |
| G-3 | **Moving a moment to yesterday.** The architecture's 12:30 AM edge case says the user can move it to yesterday's jar from Moment options. FR-CAP-10 says "move to another empty slot in the same jar". | FR wins: same-jar moves only. The 12:30 AM case is covered by deleting and re-adding through My days → Fill this jar. See D-3. |
| G-4 | **Contact matching has no phone numbers.** FR-ONB-06 matches "by hashed phone number only", but sign-up is Apple, Google or email, so Pickld never learns users' phone numbers and nothing would match. FR-NOT-02 "friend joined" and FR-SOC-02/FR-EXP-02 suggestions rely on the same matching. | See D-4. |
| G-5 | **A P0 screen links to a P1 screen.** The Jars, empty "Find people" button goes to Explore (P1), and its "People you may know" list is FR-EXP-02 (P1). | At launch, Find people opens Find friends (contacts and invite link), and the suggestions show only contact matches. See D-5. |
| G-6 | **Premium stickers in launch designs.** The Stickers tool design shows Pinoy Life, Barkada, Christmas and a "New: Christmas pack · ₱49 / Shop" banner. Settings shows a My stickers row (FR-STK-08, P1). Purchases are P1. | Until M6, hide locked packs, the shop banner and the My stickers row. See D-6. |
| G-7 | **Gendered copy.** "Read her days" (ProfileOther) and "Dale shared his Sunday" (WebShare) need a pronoun, and Pickld doesn't collect gender. FR-SOC-07 calls the button "Read". | Use neutral copy: "Read" / "Read back" / "Reading" on buttons, and "Dale shared a Sunday jar" on the web page. Copy change, see D-7. |
| G-8 | **Milestone set differs in three places.** FR-STK-05: first full jar, 7 full jars, 30 jars, 100 jars, 1 year. Product pack catalog: no 100 jars, adds "Pickld OG". Architecture trigger: first, 7 full, 100 jars. | FR wins: the five FR milestones. "Pickld OG" isn't at launch unless approved (D-8). |
| G-9 | **Link format.** FR-ONB-06 and FR-SOC-10 use `pickld.me/username`; the architecture's deep links use `pickld.me/u/dale` and `pickld.me/j/<id>`. | Canonical `pickld.me/<username>` (FR wins), jar links `pickld.me/j/<id>`, and `/u/<username>` redirects. Reserve route words (j, u, api, app, help, terms, privacy, guidelines, mod, …) as usernames. |
| G-10 | **Email sign-up path.** The product table says "Continue with email → About you"; FR-ACC-01 says email uses a one-tap link. | Email goes to Check your email, then the link opens About you. |
| G-11 | **What "n of 8" counts.** `moments_count_sync` counts every non-removed moment, including private and checking ones. Readers would see "6/8" while only 5 are visible, and Full jar could leak that private moments exist. | The owner's count (Today, Full jar, milestones, jar_count) includes private and checking moments. Others see a separate `visible_count` (live, not private). See D-9. |
| G-12 | **Replace keeps the old photo until the new one uploads** (FR-JAR-03), but the new photo also has to pass moderation, and `unique (jar_id, slot)` allows only one row. | Add additive `pending_photo_path`, `pending_thumb_path`, `pending_caption` and `pending_edits` columns. The old photo stays visible until `fn:moderate` approves the pending one and swaps it in. |
| G-13 | **Strikes are underspecified.** Does an automatic removal count? Does "Remove and warn" count? What if an appeal overturns a removal? | Every removal still standing counts (automatic or moderator, including Remove and warn, which also sends a warning). An appeal that overturns the removal clears the strike. See D-10. |
| G-14 | **Are a suspended user's jars visible to others?** `can_view_jar` hides them (it requires an active owner); nothing in the docs says so. A suspended user can also still insert moments and comments. | During suspension, hide the user's content from others and block their writes. The owner can still view their own data. See D-11. |
| G-15 | **Screens with no design:** suspension notice (FR-SAF-06), console access-denied (FR-MOD-01), Replace prompt (FR-JAR-03), appeal sent confirmation (FR-SAF-05), web teaser for Readers-only jars (FR-WEB-01), Delete moment confirmation (FR-CAP-10), Share profile. | Build them from the component kit following the nearest design (Removed for the suspension notice, Block dialog for confirmations, WebShare for the teaser) and flag them in milestone reports as "no design". |
| G-16 | **Anonymous web vs. the RLS rule.** FR-PUB-03 says Everyone jars appear on the shared-link page, but `can_view_jar` requires `viewer is not null`, and the sticker catalog is readable only by signed-in users (so stickers can't render on the web, FR-STK-04). Rule 2 forbids a service key in web pages. | Add narrow `security definer` RPCs callable by anon: `public_profile(username)`, `public_jar(id)` (Everyone jars only, live and not private) and a catalog read. The web app uses the anon key, and private data stays unreachable. |
| G-17 | **Photo delivery.** NFR-SEC-02 wants short-lived signed links for non-public photos, but the architecture has readers load photos "through the CDN" (cacheable). A jar can switch from Everyone to Only me after its photos were cached publicly. | All photos go through a Cloudflare Worker in front of R2 that checks a short-lived HMAC token. `fn:photo-urls` issues tokens in batches after checking `can_view_jar`. There are no permanent public URLs, so changing visibility takes effect when the tokens expire (≤ 15 min). See D-12. |
| G-18 | **The second-opinion vision AI is unnamed** (AGENTS.md: "vision-AI second opinion only for borderline scores"). It is a paid call. | See D-13. |
| G-19 | **Analytics and private moments.** NFR-ANL-01 tracks "moments per active day"; rule 9 says private moments never reach analytics. | Events carry no moment ids, photos or captions, and private moments are left out of moment events entirely. |
| G-20 | **Under 13 vs. auth.** The auth user exists before About you, and the client can't delete `auth.users`. | `fn:account-purge` deletes the auth user and any uploaded avatar, and nothing about the attempt is stored (COPPA). |
| G-21 | **Starting status.** AGENTS rule 4 says moments start in `checking`; the schema's default is `uploading`, and the architecture lists `uploading`. | The row is inserted after the upload succeeds, with status `checking`. `uploading` stays available for the server-side Replace flow. No column is renamed or dropped. |
| G-22 | **Settings reminder times in the design (7:00 / 1:00 / 7:30) match no quiz preset.** | Placeholder data; the build shows the saved values. |
| G-23 | **Tasks list vs. brief milestones.** The tasks.md phases line up with M1–M5, and "After launch" becomes M6. Human-only tasks (T-007 vendor paperwork, T-008 legal drafts, T-114 usability test, T-210 playbook, T-308 store screenshots and Filipino copy, T-406 announcement) can't be done by an agent. | Keep them in the plan as `design`-area issues owned by founders. Agent work never waits on them, except launch submission, which needs the accounts. |

### 2.2 Things the docs leave open (no conflict, needs a default)

- **Jar visibility change after publishing** happens "from the jar's menu"; Story has no menu in the design → add an overflow menu on the owner's jar page.
- **Unpublishing** isn't defined → switching to Only me is the way to unpublish; `published_at` stays set.
- **Several devices**: two devices creating today's jar at once → upsert on `(user_id, local_date)`.
- **Time zone in quiet hours**: the server uses `profiles.home_tz`, which the app keeps updated when the device zone changes. The 0001 default of `Asia/Manila` gets replaced by the device zone at sign-up.
- **Username moderation** is in the architecture but not in FR-ACC-03 → run usernames and bios through the text check; a flagged username is refused at save with a generic message.
- **Contacts privacy**: plain hashes of phone numbers can be brute-forced → keyed HMAC on the server, rate limits, and the raw list never stored.

### 2.3 Schema review of `0001_init.sql`

0001 hasn't been applied anywhere yet, but I'll leave it as delivered and fix it with additive migrations (0002+). That keeps the trail visible and nothing gets dropped or renamed. Findings, worst first:

| # | Defect | Effect | Fix (additive) |
| --- | --- | --- | --- |
| S-1 | `profiles_owner_update` lets the owner write any column. | **A suspended user can set `status = 'active'`**, edit `reader_count`, `jar_count` and `created_at`. | BEFORE UPDATE guard: only profile fields (name, username, bio, photos, lid, default_visibility, home_tz) are editable. |
| S-2 | `moments_owner` is `for all`, and the guard trigger checks only promotion to live/removed. | The owner can **swap `photo_path` or `caption` on a live moment and skip moderation**, set a `removed` moment back to `checking`, re-point `jar_id` to another user's jar, or change `slot`/`jar_id` without updating counts or the backfill flag. | Guard trigger: photo and caption changes go through the pending/recheck path; status changes allowed only from the server; `jar_id` locked (moves are same-jar per FR-CAP-10); `slot` changes only to an empty slot; counts re-synced. |
| S-3 | `comments_soft_delete` lets the comment author or jar owner update any column. | **The author can set `is_hidden = false` and skip the text check**; the jar owner can rewrite other people's comments. | Replace with a `delete_comment(id)` RPC; deny direct updates. |
| S-4 | `revoke select (birthday)` doesn't work while the table-level SELECT grant (Supabase default) is in place. | **Every signed-in user can read every birthday** through `profiles_others_select`. | Revoke table-level SELECT and grant a column list without birthday; owner reads birthday through a `my_profile()` RPC. |
| S-5 | `jars_update` lets the owner write any column. | The owner can fake `like_count`/`moment_count`, or change `local_date`/`tz` and undo the "Added later" logic. | Guard: only `visibility` and `published_at` are editable by the owner. |
| S-6 | No triggers for `like_count`/`comment_count`, or for like, comment, reply, full_jar and friend_joined notifications, or for milestones. | FR-SOC-05, FR-NOT-02, FR-NOT-03 and FR-STK-05 can't work. | Add the triggers in their tasks. |
| S-7 | `reactions_insert` and `appeals_owner_insert` don't check targets. | Anyone can like a jar they can't see (and set off a notification). Anyone can appeal any moderation item. | Check `can_view_jar` on insert; check ownership and `removed` state on appeals. |
| S-8 | Comments: one level of replies and a same-jar parent aren't enforced. | Deep threads; replies attached across jars. | Trigger check. |
| S-9 | `jars.tz` isn't validated, and `local_date` can be in the future on insert. | A bad zone breaks `jar_ends_at`; future jars appear in feeds. | Check against `pg_timezone_names`; reject future dates on insert. |
| S-10 | Suspended and deleted users can still insert moments, comments, follows and reactions. | FR-SAF-06 isn't enforced. | `is_active_user()` in insert policies. |
| S-11 | No model for "3 reports in 24 h hides a moment"; `moderation_items` has no profile/username target and no link to the report. | Architecture rule unimplementable. | Add `report_id`, `profile_id` columns and a report trigger. |
| S-12 | Missing tables and columns: `notification_prefs` (types, quiet hours), `profiles.feed_seen_at`, `profiles.suspended_until`, strikes, `account_jobs` (export and delete), `contact_hashes`, `reserved_usernames`, `csam_incidents`, `jars.ends_at`, `jars.visible_count`, the `pending_*` moment columns, `onboarding_answers.promise_skipped_at`. | Needed by FR-NOT-04, SOC-01, SAF-06, PRV-02/03, ONB-06/07, JAR-03/05. | Add each in the task that needs it. |
| S-13 | `notifications_mark_read` allows updating any column. | The owner can rewrite their notification rows (low impact). | Limit to `read_at`. |
| S-14 | Catalog policies require `authenticated`. | The web page can't render stickers (FR-STK-04). | Anon read via RPC (G-16). |
| S-15 | `check (birthday <= current_date - interval '13 years')` uses a non-immutable expression. | Works, but `pg_dump`/restore can complain. | Keep, and enforce in the app and in `fn:account-purge`; test it in pgTAP. |

## 3. Risks and mitigations

### Technical

| Risk | Mitigation |
| --- | --- |
| The Skia editor (stickers, bubbles, text with gestures) is the largest single piece of app work. | Split into small tasks: transform engine, then stickers, then bubbles, then text. The architecture's fallback still applies: ship filters and stickers, then bubbles and text in the first update (needs PO approval as a P0 reorder). |
| Background upload and "never lose a photo" across app kills, iOS background sessions and gallery deletion. | The queue writes to SQLite and the photo is copied to app storage before any network call. Unit tests for the state machine, plus a Maestro flow that kills the app mid-upload. |
| Time zones, DST, the date line and westward travel (G-1). | `lib/jars.ts` is pure, with table-driven tests (Manila↔London, Tokyo, Honolulu, DST on both sides, 23:59/00:00). The server enforces the same rules, with pgTAP tests. |
| No camera in the iOS Simulator (vision-camera returns no device). | A dev-only mock camera device feeds a still frame, so Camera screens can be screenshotted and Maestro can run. |
| `react-native-vision-camera`, Skia and RevenueCat need a development build (not Expo Go). | `expo prebuild` / `expo run:ios` on the Mac satellite; EAS development builds for devices. |
| R2 signed reads add latency to every feed page (G-17). | Token batches per feed page, 15-minute tokens, thumbnails first. |
| Local backend for tests: the orb's Docker daemon isn't running right now. | Start dockerd in the orb (or use the Mac satellite) for `supabase start` and pgTAP; CI runs `supabase test db` on GitHub Actions. |

### Store review

| Risk | Mitigation |
| --- | --- |
| Apple guideline 1.2 (user-generated content) requires agreeing to terms that ban objectionable content, a filter, report, block, and acting on reports within 24 hours. | Terms agreement on Sign up (the design already has the line), automatic checks, report and block at launch, the moderation console, and an on-call moderator before submission (founders). |
| Sign in with Apple is required because Google sign-in is offered. | Already in FR-ACC-01. |
| Account deletion in the app (Apple 5.1.1(v)). | FR-PRV-03 is P0. |
| Contacts upload (Apple 5.1.2, Google Play user data policy). | Reason card before the system prompt (FR-ONB-05), hashing on the device and HMAC on the server, disclosed in the privacy labels. |
| Age rating and child safety (13+, Google Families policy doesn't apply). | Birthday gate, CSAM pipeline, Community Guidelines published. |
| Beta review needs time. | TestFlight and Play internal testing build by week 10 (M4 end). |

### Safety and legal

| Risk | Mitigation |
| --- | --- |
| **I haven't checked how Cloudflare's CSAM Scanning Tool reports a match.** My understanding is that it scans images as they're served through Cloudflare's cache, blocks matching URLs and notifies by email rather than calling an API. If that's right, FR-SAF-04's automatic block, suspension and reporting flow needs extra work. | Verify early in M1 (T-006/T-007). `fn:moderate` fetches the thumbnail through the CDN first and treats a block response as a match. Plan B is a scanner with an API (PhotoDNA, Thorn Safer), which would be a new paid vendor, so it needs PO approval. |
| OpenAI moderation scores for images cover fewer categories than for text, and scores shift between model versions. | Conservative thresholds, the borderline second opinion, a weekly tuning review, and a model-version pin and alert. |
| The legal reporting flow (NCMEC, Philippines Anti-OSAEC) needs trained humans and registered accounts. | Founders own it; the system only stores a `csam_incidents` record and alerts. |
| No moderators means reports go unanswered (NFR-REL-01 alert at 2 h). | The founders' moderation rota has to exist before beta. |

### Schedule

| Risk | Mitigation |
| --- | --- |
| External accounts and keys (Supabase ×3, Cloudflare R2 and CSAM, OpenAI, Apple and Google developer accounts, Expo/EAS, Sentry, PostHog, Vercel, RevenueCat) aren't available in this workspace. | Build and test against local Supabase, a local S3-compatible bucket and a stubbed moderation provider. Each integration task lists the credential it needs, and I report blocks as soon as I reach one (D-14). |
| Android emulators can't run in an orb (no KVM). I haven't checked whether the Mac satellite can run one; it's itself a VM, so probably not. | iOS Simulator screenshots on the Mac satellite; for Android see D-15. |
| A PR-per-issue flow with ~100 issues needs merges to move forward, but the brief only stops at milestones. | D-16: I squash-merge each PR once CI is green, and the PO reviews at each milestone stop. |
| 12-week dates are written for a team of three. | Milestones are kept as an order and scope, not calendar promises; the slips section of each milestone report tracks this. |

## 4. Open decisions for the product owner

If you don't answer one, I'll use the recommended default and record it in `docs/decisions.md`.

| # | Decision | Recommended default |
| --- | --- | --- |
| D-1 | Westward travel same-date collision (G-1). | Additive `jars.ends_at`. On a collision, the server re-zones the open jar and moves `ends_at` later (only ever later), so those hours aren't badged. |
| D-2 | Offline captures uploaded after midnight (G-2). Changing this changes FR-JAR-06's acceptance criteria. | **Keep FR-JAR-06 strict** (server time only; late uploads show Added later). The alternative is a 3-hour grace window that trusts the queued time (spoofable). |
| D-3 | Moving a moment to another day's jar (G-3). | FR-CAP-10 as written: same jar only. |
| D-4 | Contact matching without phone numbers (G-4). Changes FR-ONB-06's acceptance criteria. | Match on keyed hashes of **email addresses and phone numbers** from contacts against users' sign-up emails (Apple "Hide my email" users won't match). Collecting phone numbers would need SMS verification, which is a paid service, so not without approval. |
| D-5 | Jars, empty → Explore (P1) (G-5). | Find people opens Find friends; suggestions show contact matches only until M6. |
| D-6 | Premium packs, shop banner and My stickers at launch (G-6). | Hidden until M6. |
| D-7 | Gendered copy (G-7). | Neutral: "Read" / "Read back" / "Reading"; "Dale shared a Sunday jar". |
| D-8 | Milestone set and "Pickld OG" (G-8). | The five FR-STK-05 milestones; no Pickld OG at launch. |
| D-9 | What others see in "n of 8" (G-11). | Others see live, non-private moments only; the owner sees everything that isn't removed. |
| D-10 | Strike rules (G-13). | Every removal still standing counts, including automatic ones and Remove and warn; an overturned appeal clears the strike. |
| D-11 | Suspended users (G-14). | Content hidden from others and writes blocked for 7 days; the owner sees the suspension notice and their own data. |
| D-12 | Photo delivery (G-17). | Worker plus short-lived HMAC tokens for every photo, with no permanent public URLs. Cloudflare Workers is within the already-listed Cloudflare vendor (free tier). |
| D-13 | Second-opinion vision AI (G-18). This is a paid call. | An OpenAI vision model (same vendor and DPA as moderation), only for borderline scores (~3% of photos). |
| D-14 | Credentials and accounts. | I build everything against local services first. You (founders) create the accounts and add keys as Amp secrets when an integration task needs them: Supabase staging and prod (Singapore), Cloudflare (R2, Workers, CSAM tool), OpenAI, Expo/EAS, Sentry, PostHog, Vercel, and the Apple and Google developer accounts. |
| D-15 | Android screenshots and tests (orbs have no emulator). | iOS Simulator screenshots on the Mac satellite every milestone. Android screenshots only if you connect an Android device or runner, or approve EAS-hosted Maestro runs (paid); otherwise each report shows Android as "not captured". |
| D-16 | PR merging during Phase 4, and pushing the handoff. | I squash-merge my own PRs into `main` once CI passes, and you review at each milestone stop. The handoff and Phase 1–2 docs get pushed to `main` at the start of Phase 3, before the issues are created. |
| D-17 | Tab name "My days" vs "Calendar" (product open question). | Keep "My days" (matches the approved designs). |
| D-18 | Everyone jars in Explore (P1 open question). | Included by default (Everyone already means any signed-in user). |
