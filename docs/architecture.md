# Pickld 2.0 — Architecture Plan

Nov 10, 2026 · @Eng

## Summary

Pickld 2.0 is a React Native (Expo) app on Supabase, with photos stored on Cloudflare R2 behind a CDN, a safety check on every photo before anyone else can see it, and two small web apps: the shared-link page and the moderation console. This plan builds on the [Product & Screen Documentation](https://claude.ai/artifact/PboNAB1FCxs72bDLZYr7tW); screen names below match the design canvas.

Three principles shape everything:

- **The database is the referee.** Who can see a jar, one moment per slot, and the backfill badge are enforced in Postgres, not just in the app.
- **The phone works offline.** Moments save locally first and upload in the background, so capture never waits on the network.
- **Nothing goes public unchecked.** Every photo is scanned before readers see it; child-safety matches never enter a human queue.

### Decisions to confirm (storage, child-safety scanning and moderation confirmed Nov 10)

| Decision | Recommendation | Why | Alternative |
| --- | --- | --- | --- |
| Photo storage | Cloudflare R2 + Cloudflare CDN | No bandwidth fees, which matters with 8 photos per user per day | Backblaze B2 behind Cloudflare (a little under half of R2’s storage cost; revisit when photo costs pass about $100 a month, see `docs/photo-storage-costs.md`) or Supabase Storage (simplest, most expensive at scale) |
| Data region | Supabase in Singapore | Closest to the Philippines launch base, fine for global users | Tokyo, or US East for a US-first audience |
| Child-safety scanning | Cloudflare CSAM Scanning Tool | Free with Cloudflare, matches known material on upload | Microsoft PhotoDNA, Thorn Safer |
| Nudity and violence checks | OpenAI omni-moderation (free), plus a vision AI second opinion on borderline photos | No per-call cost; scores photos for sexual content, violence and self-harm, and text for hate and harassment | Hive, AWS Rekognition or Google SafeSearch if more image categories are needed |
| In-app purchases | RevenueCat | Handles App Store and Google Play receipts and restores | Building receipt checks ourselves |
| Analytics and crashes | PostHog + Sentry | Product analytics and crash reports, both with free tiers | Firebase Analytics + Crashlytics |
| Web apps | Next.js on Vercel | Server-rendered link previews for shared jars | Expo Router web |
| Home screen widget | After launch | Needs native iOS and Android code; not core to the loop | Ship at launch with extra weeks |

## System overview

Three clients share one Supabase backend; photos bypass the database entirely and go straight to Cloudflare.

&#91;embedded content: System overview · 3 clients, Supabase, 4 outside services\]

The app uploads photos to R2 with short-lived signed links from a server function, and readers load them through the CDN. Server functions call the safety checks on every new photo, send pushes through Expo, and receive purchase confirmations from RevenueCat.

## Data model

All data lives in Postgres (Supabase). Photos live in R2; the database stores only their paths. The jar is the center of the model: one row per user per local date, holding up to eight moments.

### Core

| Table | Key fields | Rules |
| --- | --- | --- |
| `profiles` | id (= auth user), username, display\_name, bio, avatar\_path, cover\_path, birthday, lid\_color, home\_tz, reader\_count, author\_count, jar\_count, status | username unique, case-insensitive; birthday private; status = active, suspended or deleted |
| `jars` | id, user\_id, local\_date, tz, visibility, published\_at, moment\_count, is\_full, like\_count, comment\_count, updated\_at | unique (user\_id, local\_date); visibility = readers, everyone or only\_me; hidden from others until published\_at is set |
| `moments` | id, jar\_id, user\_id, slot, photo\_path, thumb\_path, caption, captured\_at, added\_at, is\_backfilled, is\_private, edits, status, like\_count | unique (jar\_id, slot); slot is one of the 8 hashtags; edits = filter, stickers, bubbles, text as JSON; status = uploading, checking, live or removed |
| `follows` | reader\_id, author\_id, created\_at | primary key (reader\_id, author\_id); no self-follows |
| `blocks` | blocker\_id, blocked\_id, created\_at | a block removes any follows both ways |

### Social

| Table | Key fields | Rules |
| --- | --- | --- |
| `reactions` | user\_id, target\_type, target\_id, created\_at | one like per user per jar or moment |
| `comments` | id, jar\_id, user\_id, parent\_id, body, created\_at, deleted\_at | one level of replies; soft delete |
| `notifications` | id, user\_id, type, actor\_id, jar\_id, moment\_id, read\_at, created\_at | written by database triggers |
| `push_tokens` | user\_id, token, platform, updated\_at | one row per device |

### Personal settings

| Table | Key fields | Rules |
| --- | --- | --- |
| `reminder_settings` | user\_id, slot (morning, afternoon, evening), local\_time, enabled | owner only; mirrored on the phone for local reminders |
| `onboarding_answers` | user\_id, day\_type, whoamiwith\[\], mebusywith\[\], ootd, promise\_accepted\_at | owner only; used for reminder defaults and sticker suggestions |
| `milestones` | user\_id, key, achieved\_at | e.g. first\_full\_jar, jars\_100 |

### Stickers

| Table | Key fields | Rules |
| --- | --- | --- |
| `sticker_packs` | id, slug, name, tier, store\_product\_id, available\_from, available\_to, locale, artist\_id, sort | tier = free, premium, earned or seasonal |
| `stickers` | id, pack\_id, label, asset\_path, tags\[\], slot\_hint, sort | slot\_hint powers “For #afternoon” suggestions |
| `owned_packs` | user\_id, pack\_id, source, store\_transaction\_id, acquired\_at | source = free, purchase, earned or subscription |
| `user_pack_prefs` | user\_id, pack\_id, sort, hidden | powers My stickers |

### Safety

| Table | Key fields | Rules |
| --- | --- | --- |
| `reports` | id, reporter\_id, target\_type, target\_id, reason, note, status, created\_at | reporter never shown to the reported user |
| `moderation_items` | id, moment\_id, source, scores, status, decided\_by, decided\_at, decision\_reason | source = auto\_check, report or appeal; status = pending, kept, removed or escalated |
| `appeals` | id, moderation\_item\_id, user\_id, message, status, created\_at | one appeal per removal |
| `audit_log` | id, actor\_id, action, target\_type, target\_id, data, created\_at | append only; every moderator action |

Counts (readers, likes, moments per jar) are kept up to date by database triggers so profiles and feeds load without counting rows.

## Visibility and security rules

Visibility is enforced with Postgres row-level security, so a bug in the app can never leak a private moment. One shared function, `can_view_jar(viewer, jar)`, is used by every policy that touches jars, moments, reactions and comments.

### Who can see a jar

A viewer sees a jar when any of these is true, and no block exists in either direction:

1. The viewer owns it.
2. It is published, visibility is **Everyone**, and it hasn’t been removed.
3. It is published, visibility is **Readers**, and the viewer reads the author.

Only me jars are visible to the owner alone, published or not.

### Who can see a moment

A moment is visible to others only when its jar is visible, it is not private, and its status is **live**. Owners always see their own moments in every state, including uploading, checking and removed.

### Everything else

| Data | Who can read | Who can write |
| --- | --- | --- |
| Profile name, username, bio, photos, counts | Anyone not blocked | Owner |
| Birthday, onboarding answers, reminder settings | Owner only | Owner |
| Readers and Authors lists | Anyone not blocked | Follower adds or removes their own follow; author can remove a reader |
| Likes and comments | Anyone who can see the jar | Anyone who can see the jar; comment author or jar owner can delete |
| Reports | Moderators only | Any signed-in user |
| Moderation items, appeals, audit log | Moderators only | Server functions and moderators |
| Sticker catalog | Everyone | Admins only |
| Owned packs | Owner | Server only, after a verified purchase |

### Roles and keys

- **Users** sign in with Supabase Auth (Apple, Google or email link). Their token carries no extra powers.
- **Moderators** get a `moderator` role claim, checked by the console and by policies on safety tables.
- **Server functions** use the service key, which never ships in the app or the web pages.

Performance: `can_view_jar` relies on indexes on `follows (reader_id, author_id)`, `blocks` in both directions, and `jars (user_id, local_date)`.

## Capture to publish

Capture never waits on the network: the moment appears on Today instantly, uploads when it can, and only reaches readers after the safety check.

&#91;embedded content: Capture to publish · offline loop and 4 safety outcomes\]

1. **On the phone:** the photo is cropped to 3:4, resized to 1440 × 1920, stripped of location data, and saved with its slot, caption and edits in the offline queue.
2. **Upload:** a server function issues a short-lived signed link; the app uploads the photo and its thumbnail straight to R2, then creates the `moments` row with status **checking**.
3. **Check:** the upload triggers the safety check; the result sets status to **live** or **removed**, or leaves it hidden in the review queue.
4. **Publish:** live moments appear to others only when their jar is published. Once a jar is published, new live moments that day go out automatically.
5. **Failure:** uploads retry with growing waits; after repeated failures the tile shows Didn’t upload with Retry, and the photo stays safe on the phone.

## Days, time zones and backfill

There is no midnight job. “Today” is worked out on the phone from the clock and time zone, and each jar stores its own date and zone, so millions of users reset at their own midnight for free.

### Which jar a new moment goes into

1. The app looks for an open jar: one whose local midnight (in the jar’s own zone) hasn’t passed yet.
2. If there is one, the moment goes there, even if the phone has since changed zones. This is the travel rule: today’s jar finishes in the zone it started in.
3. If not, the app creates a new jar for today using the phone’s current zone, which is the moment it shows the “You’re in Tokyo time” banner if the zone changed.
4. The server checks that the jar date makes sense for its zone and rejects dates in the future.

### Backfill and “Added later”

- A jar’s end is the next local midnight in its zone.
- `added_at` is always the server’s clock, never the phone’s, so changing the phone’s time can’t dodge the badge.
- `is_backfilled` is computed by the database: true when `added_at` is after the jar’s end. The badge appears wherever the moment is shown.
- `captured_at` comes from the photo’s own timestamp when available, and is shown as the moment’s time.

### Edge cases

| Case | Behavior |
| --- | --- |
| Posting #evening at 12:30 AM | Goes into the new day’s jar if that slot is empty there; the user can move it to yesterday from Moment options (then it shows Added later) |
| Flying east across the date line | The open jar finishes in its zone; the next jar may start on a later date, leaving a skipped day in My days, which is expected |
| Slot already filled | The database refuses a second moment in the same slot; the app offers to replace it |
| Daylight saving changes | Handled by storing zone names (e.g. Asia/Manila), never fixed offsets |

## Notifications

Reminders and social notifications travel two different roads: reminders are scheduled on the phone, social notifications come from the server.

### Slot reminders (on the phone)

- The app schedules local notifications with `expo-notifications` for the next 7 days, one per enabled slot at the user’s chosen times.
- Adding a moment to a slot cancels that slot’s reminder for today, so a filled slot is never nagged.
- Reminders are rescheduled when the app opens, when settings change, and when the time zone changes.
- Copy rotates from a small set per slot (“Afternoon’s here”, “What are you up to right now?”) and never mentions streaks or missed days.
- Benefits: works offline, follows the phone’s zone automatically, costs nothing on the server.

### Social notifications (from the server)

1. A database trigger writes a row to `notifications` when someone follows, likes, comments, or when a jar fills up.
2. A database webhook calls a server function, which batches rows (for example “Aya and 12 others liked your jar”) and sends them through Expo’s push service to every token in `push_tokens`.
3. Expo’s delivery receipts are checked; dead tokens are deleted.
4. The in-app Notifications screen reads the same table, so push and the screen always agree.

| Type | Push | In-app |
| --- | --- | --- |
| Slot reminder | Local | Pinned card while the slot is empty |
| New reader | Yes | Yes, with Read back |
| Likes on a jar | Batched | Yes |
| Comment or reply | Yes | Yes |
| Full jar milestone | No (celebration happens in the app) | Yes |
| Moment removed or appeal decided | Yes | Yes, opens the notice |
| Friend joined | Yes, at most one a day | Yes |

Users can turn each type off in Settings; quiet hours default to 10 PM to 7 AM in the user’s zone for server pushes.

## Moderation, reports and appeals

Safety has three layers: automatic checks on every photo, user reports, and human review in the moderation console. Every decision is written to the audit log.

### Automatic checks (every photo)

1. **Child safety first.** Photos pass through Cloudflare’s CSAM scanning on upload. A match blocks the photo immediately, suspends the account, and goes to a separate legal reporting flow handled by a small trained group, never the regular queue. Reporting obligations apply, such as the Philippines’ Anti-OSAEC law and NCMEC reporting where US rules apply.
2. **Content scores.** OpenAI’s free moderation model (omni-moderation) scores each photo’s 480 px thumbnail together with its caption for sexual content, violence and self-harm. Comments, usernames and bios are scored as text for hate, harassment and other categories. Borderline photos get a second opinion from a vision AI, whose short written reason appears in the moderation console.
3. **Decision by score:**

| Score | Outcome |
| --- | --- |
| Low on everything | Goes live immediately (most photos, within seconds) |
| Medium on any category | Stays hidden from others, enters the console queue as Auto-check |
| High on nudity or violence | Removed automatically; the owner gets the Moment removed notice and can appeal |

Thresholds start conservative, are tuned weekly from moderator decisions, and are re-checked whenever OpenAI updates its moderation model, since its scores can shift between versions.

### Reports

- A report creates a `reports` row and, for moments, a `moderation_items` entry with source **Report**.
- Three reports on the same moment within 24 hours hide it from others until reviewed.
- The reporter sees “Report sent”; the reported user never learns who reported them.

### Review and appeals

- Moderators work oldest first; photos stay blurred until they choose to view.
- Actions: Keep, Remove, Remove and warn, Escalate. Three removals in 90 days suspends the account for 7 days; escalations go to the founders.
- “Request a review” creates an `appeals` row; a different moderator decides it, and the user is notified either way.

### Sticker and profile content

Usernames, bios and profile photos go through the same checks. Sticker packs are made in-house or by vetted artists, so they skip the queue.

## Stickers and purchases

The sticker catalog lives on the server, so new and seasonal packs ship without an app update. Purchases go through the App Store and Google Play, verified by RevenueCat.

### Catalog and rendering

- `sticker_packs` and `stickers` are read by everyone; sticker art is SVG or PNG on the CDN, cached on the phone after first use.
- The Stickers tool shows the current slot’s suggestions first (`slot_hint` plus onboarding answers), then owned packs in the user’s order, then locked packs.
- A moment stores sticker id, position, scale and rotation in `edits`. The photo file itself stays clean, so jars and jar cards can be redrawn at any size, and anyone viewing sees stickers without owning the pack.

### Buying a pack

1. The user taps Get on Pack preview; the app starts the store purchase through the RevenueCat SDK.
2. RevenueCat verifies the receipt with Apple or Google and calls our server webhook.
3. The webhook writes `owned_packs` with the store transaction id; only the server can write this table.
4. The app refreshes and unlocks the pack. Restore purchases on My stickers asks RevenueCat to replay past purchases.

### Earned stickers

A database trigger checks milestones when a jar fills (first full jar, 7 full jars, 100 jars) and grants the Milestones stickers, which shows the Sticker unlocked celebration.

### Pickld+ later

A future subscription maps to `owned_packs.source = subscription` for every premium pack, with RevenueCat entitlements deciding access. No schema change is needed.

## App structure

One Expo app for iOS and Android, built with Expo Router, NativeWind (styling from the design tokens), TanStack Query for server data, and a small local database for offline work.

### Routes

| Group | Routes (screens) |
| --- | --- |
| Onboarding | `/welcome`, `/intro/[step]`, `/sign-up`, `/sign-in`, `/check-email`, `/setup/about`, `/setup/day`, `/setup/people`, `/setup/jar-lid`, `/setup/permissions`, `/setup/friends`, `/setup/promise` |
| Tabs | `/(tabs)/today`, `/(tabs)/jars` (D-52; `/(tabs)/capture` is hidden from the bar), `/my-days` (stack screen opened from Today) |
| Capture flow (modal) | `/camera`, `/crop`, `/edit/[momentId]` (Filters, Stickers, Bubble, Text tabs), `/publish` |
| Jars and people | `/jar/[id]`, `/moment/[id]`, `/comments/[jarId]`, `/share/[jarId]`, `/u/[username]`, `/u/[username]/readers`, `/notifications`, `/explore`, `/memories` |
| Stickers | `/stickers/shop`, `/stickers/pack/[slug]`, `/stickers/mine` |
| Settings | `/settings`, `/settings/profile`, `/settings/blocked`, `/settings/help`, `/settings/delete` |

Deep links (`pickld.me/u/dale`, `pickld.me/j/<id>`) open the same routes when the app is installed.

### Data on the phone

- **Server data:** TanStack Query caches feeds, jars and profiles, with pull to refresh. No live sockets at launch.
- **Offline queue:** `expo-sqlite` holds pending moments (slot, jar date and zone, caption, edits, file path) and their upload state. Photos are copied into the app’s own folder with `expo-file-system` so they survive the gallery being cleaned.
- **Background upload:** uploads resume when the app returns online or is reopened; iOS background upload sessions keep large uploads going when the app is closed.
- **UI state:** a small Zustand store for things like the selected editor tab.

### Native pieces

| Feature | Library |
| --- | --- |
| Camera (4:3 sensor format, so photos are 3:4) | `react-native-vision-camera` |
| Crop, pinch and drag | `react-native-gesture-handler` + Reanimated; `expo-image-manipulator` for the final crop and resize |
| Filters, stickers, bubbles, text, jar card export | React Native Skia |
| Frosted tab bar and sheets | `expo-blur`, `@gorhom/bottom-sheet` |
| Images | `expo-image` |
| Purchases | RevenueCat SDK |
| Home screen widget (after launch) | Native WidgetKit (iOS) and Glance (Android) extensions via an Expo config plugin, reading today’s jar from shared app storage |

### The two web apps

- **Shared-link page** (`pickld.me`): Next.js on Vercel. It shows Everyone jars and public profiles, renders link-preview images for social apps, and links to the stores. Readers-only jars show a teaser with “Open in the app”.
- **Moderation console** (`mod.pickld.me`): a separate Next.js app behind Supabase Auth with the moderator role, using server functions for every action so they’re all logged.

## Infrastructure, scaling and cost

Photos are the main cost driver, not the database. Each moment is stored twice: a 1440 × 1920 WebP (about 300 KB) and a 480 px thumbnail (about 40 KB). At an average of 4 moments per active user per day, that’s roughly 40 MB of new storage per daily active user per month.

### Environments and delivery

- **Three environments:** development, staging and production, each with its own Supabase project and R2 bucket.
- **App builds:** EAS Build and EAS Submit for store releases; EAS Update for small fixes without a store review.
- **Database changes:** migrations in the repo, applied by CI to staging first, then production.
- **Backups:** Supabase daily backups from day one; point-in-time recovery once there are paying users. R2 objects are never overwritten, only added or deleted.
- **Monitoring:** Sentry for app and server errors, PostHog for product analytics, an uptime check on the API and web page, and alerts on queue size in the moderation console.

### What it costs as Pickld grows

Rough planning figures, to be checked against current price lists before launch:

| Item | What drives it | At 1,000 daily users | At 10,000 daily users |
| --- | --- | --- | --- |
| Supabase (database, auth, functions) | Plan plus compute size | about $25–50 a month | about $100–300 a month |
| R2 photo storage | Total photos kept (grows every month) | about $1 a month in year one | about $5–75 a month over year one |
| R2 bandwidth | Photo views | $0 (no egress fees) | $0 (no egress fees) |
| Content-safety API | OpenAI checks are free; only second opinions on borderline photos (about 3%) cost money | about $4–18 a month | about $36–180 a month |
| Push, purchases, analytics, crashes | Mostly free tiers at this size | $0–50 a month | $50–300 a month |
| Vercel (web apps) | Page views | free to $20 a month | about $20–100 a month |

OpenAI’s moderation endpoint is free but rate-limited by account tier. At about 100,000 daily users the evening peak is around 1,700 checks a minute, so confirm the tier’s limit before then; if it’s hit, photos simply stay in Checking a few seconds longer. Only thumbnails are sent for checks.

### Scaling path

1. **Launch to about 50,000 daily users:** one Supabase database with the indexes above; the Jars feed is a simple query over authors you read, ordered by last update.
2. **Beyond that:** add a read replica for feeds and profiles, cache public jars on the CDN, and precompute feeds for very active readers.
3. **Photo processing** stays on Cloudflare (resize on the edge), so it scales without servers.

## Privacy and compliance

Launching globally means meeting the Philippines’ Data Privacy Act, the EU’s GDPR and US child-privacy rules (COPPA) from day one. This section lists what the system does; the legal wording of the policies needs a lawyer’s review.

| Area | What the system does |
| --- | --- |
| Photo location data | The app strips GPS and other EXIF location data before upload. Only the capture time is kept. |
| Age | Birthday is required at sign-up; under 13 is refused and nothing entered is stored. Birthday is never shown publicly. |
| Contacts | Phone numbers are hashed on the phone before matching; raw contacts never leave the device. |
| Data export | Delete account offers a download of all photos and captions as a zip, generated by a server function. |
| Account deletion | Profile hidden at once; photos, moments and personal data deleted within 30 days; anonymized safety records kept only as the law requires. |
| Data location | Stored in Singapore; EU users covered by standard contractual clauses with each vendor. |
| Vendors | Supabase, Cloudflare, OpenAI, RevenueCat, Expo, Sentry and PostHog each need a data processing agreement. |
| Analytics | No photos or captions sent to analytics; events use the user id only. |
| App store labels | Apple privacy labels and the Google Play data safety form filled from this table. |
| Registration | Check whether registration with the Philippines’ National Privacy Commission is required and name a data protection officer. |

Also needed before launch: Terms of Service, Privacy Policy and Community Guidelines (linked from Sign up, Settings and Help).

## Build plan

The designs grew a lot since the original 12-week plan, so holding the launch date means moving four things to the first one to two months after launch: sticker purchases and the shop, home screen widgets, Memories, and Explore. Everything else on the canvas ships at launch.

&#91;embedded content: Build plan · 5 phases over 12 weeks, 3 people, plus post-launch\]

The dashed line is the public launch at the end of week 12. Free stickers, the share jar card and the shared-link page stay in launch scope because they drive the first wave of growth.

### Risks to the date

- **App store review:** apps with user photos get extra scrutiny on moderation. Submit a beta build by week 10 to surface issues early.
- **Editor complexity:** Skia stickers, bubbles and text are the largest single piece of app work. If it slips, launch with filters and stickers only, and add bubbles and text in the first update.
- **Safety vendor setup:** Cloudflare CSAM scanning setup and the OpenAI data processing agreement can take time. Start both in week 1.
- **Team of three:** any absence hits the date directly; keep a weekly check-in and cut scope, not quality, if needed.
