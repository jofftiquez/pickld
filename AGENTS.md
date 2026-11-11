# AGENTS.md — Pickld 2.0

Read this file before writing any code. It tells you what Pickld is, how the repo is organized, which rules are non-negotiable, and in what order to build.

## What Pickld is

A photo diary app. Each day a user fills a **jar** with up to 8 **moments** (3:4 photos), one per fixed slot:
`whereami, mebusywith, whoamiwith, ootd, selfie, morning, afternoon, evening`.
People who follow you are **readers**; people you follow are **authors**. A new jar starts at local midnight.

Source documents (read the relevant section before each task):

- Functional Requirements (IDs like `FR-JAR-03`): https://claude.ai/artifact/BYkhxau1AexbADz8cTXMEP
- Architecture Plan: https://claude.ai/artifact/78fJutkrNtA6a3Pi7GaAxL
- Product & Screen Documentation: https://claude.ai/artifact/PboNAB1FCxs72bDLZYr7tW
- Design canvas (screens by name): https://claude.ai/artifact/3Gbzk6SyaqjeFJSLc8QcCK
- **Offline design reference:** `design/index.html` (all Hi-fi A screens) and `design/screens/<Screen>.html` — static HTML exports. Open them in a browser and inspect layout, spacing and copy; translate to React Native with the component kit and `tokens.ts`, never by copying CSS directly. Photos in `design/images/` are placeholders.

## Stack

| Layer | Choice |
| --- | --- |
| App | Expo (React Native, TypeScript, strict), Expo Router |
| Styling | NativeWind, theme from `src/theme/tokens.ts` — never hard-code colors or radii |
| Server data | TanStack Query + `@supabase/supabase-js` |
| Local data | `expo-sqlite` (offline queue, cache), `expo-file-system` (queued photos) |
| UI state | Zustand (small stores only) |
| Camera | `react-native-vision-camera` (4:3 sensor format → 3:4 portrait) |
| Editing | React Native Skia; `react-native-gesture-handler` + Reanimated |
| Images | `expo-image`; `expo-image-manipulator` for crop/resize |
| Sheets / blur | `@gorhom/bottom-sheet`, `expo-blur` |
| Backend | Supabase (Postgres + RLS, Auth, Edge Functions), region Singapore |
| Photos | Cloudflare R2 behind Cloudflare CDN; uploads via short-lived signed URLs |
| Safety | Cloudflare CSAM Scanning Tool; OpenAI `omni-moderation-latest` (free) on thumbnail + caption; vision-AI second opinion only for borderline scores |
| Push | `expo-notifications` (local reminders) + Expo push service (social) |
| Purchases (P1) | RevenueCat |
| Web | Next.js on Vercel: `apps/web` (pickld.me shared links), `apps/mod` (moderation console) |
| Monitoring | Sentry, PostHog |

## Repo layout

```
apps/
  mobile/            Expo app
    app/             Expo Router routes (see "Routes")
    src/components/  Component kit (one component per file)
    src/features/    Feature modules: jar, capture, feed, profile, stickers, settings, onboarding
    src/lib/         supabase client, queue, time zones, analytics
    src/theme/       tokens.ts (copied from handoff)
  web/               Next.js shared-link site
  mod/               Next.js moderation console
supabase/
  migrations/        SQL migrations (0001_init.sql is the starting schema)
  functions/         Edge Functions (Deno, TypeScript)
  tests/             SQL tests for RLS (pgTAP)
docs/
  tasks.md           Backlog, build in order
design/
  index.html         All screens on one page
  screens/*.html     One static HTML file per screen (Hi-fi A)
  images/            Placeholder photos used by the screens
```

## Non-negotiable rules

1. **The database is the referee.** Visibility, one-moment-per-slot, ownership and the backfill flag live in Postgres (constraints, triggers, RLS). Never rely on the app alone. Every RLS change ships with a pgTAP test that tries it as owner, reader, outsider and blocked user.
2. **Never ship a service key** to the app or web pages. Privileged work happens in Edge Functions.
3. **Offline first for capture.** A moment is written to the local queue before any network call. Never lose a queued photo.
4. **Nothing goes public unchecked.** Moments start in status `checking`; only the moderation function may set `live`. Early version (D-22): the moderation function auto-approves; the full check returns before public launch.
5. **Strip location EXIF** before upload. Keep only capture time.
6. **Server time decides "Added later".** Never trust the phone clock for `added_at`.
7. **Time zones are IANA names** (e.g. `Asia/Manila`), never offsets.
8. **No beauty or face-retouch filters.** Color filters only.
9. **Private moments never leave their owner** — not in feeds, cards, web pages, notifications or analytics.
10. **No photos or captions in analytics.**
11. **Accessibility:** every pressable has `accessibilityLabel`; tap areas ≥ 44×44 via `hitSlop`; respect Reduce Motion; support 200% text.
12. **Brand:** primary buttons are `#7fad33` with white text (deliberate). All other text meets WCAG AA.
13. **Copy** lives in translation files (`src/i18n/en.json`), never inline.

## Conventions

- TypeScript strict; no `any`. Zod for anything crossing a boundary (API, deep links, storage).
- Database types generated with `supabase gen types typescript` into `src/lib/database.types.ts`.
- One React component per file, named exports, props typed.
- Query keys: `['jar', userId, localDate]`, `['feed', cursor]`, `['profile', username]`.
- Edge Functions: one folder per function, validate input with Zod, return `{ data } | { error }`.
- Commits: `FR-ID: short description` (e.g. `FR-JAR-03: refuse second moment per slot`).
- Tests: unit (Vitest/Jest) for pure logic (time zones, queue), pgTAP for RLS, Maestro for main flows.

## Routes (Expo Router)

```
/welcome  /intro/[step]  /sign-up  /sign-in  /check-email
/setup/about  /setup/day  /setup/people  /setup/jar-lid  /setup/permissions  /setup/friends  /setup/promise
/(tabs)/today  /(tabs)/capture  /(tabs)/jars  /(tabs)/my-days
/camera  /crop  /edit/[momentId]  /publish
/jar/[id]  /moment/[id]  /comments/[jarId]  /share/[jarId]
/u/[username]  /u/[username]/readers  /notifications  /explore  /memories
/stickers/shop  /stickers/pack/[slug]  /stickers/mine
/settings  /settings/profile  /settings/blocked  /settings/help  /settings/delete
```

## Key logic you must get right

**Which jar a new moment joins** (`src/lib/jars.ts`):
1. Find an open jar: one whose next local midnight in *its own* `tz` hasn't passed (use server time when online).
2. If found, use it (travel rule). Otherwise create today's jar with the phone's current zone; if that zone differs from the previous jar's, show the Time zone banner once.
3. Past dates (gallery photo from an earlier day, or Fill this jar) go into that date's jar; the server sets `is_backfilled`.

**Current slot for the "Now" tile:** morning 05:00–11:59, afternoon 12:00–17:59, evening 18:00–23:59, local time.

**Upload pipeline:** queue row → request signed URL (`fn: upload-url`) → PUT photo + thumbnail to R2 → insert/update `moments` (status `checking`) → `fn: moderate` scores it → status `live`, `removed`, or stays hidden with a `moderation_items` row. Retry with exponential backoff (1s, 5s, 30s, 2m, 10m), then mark failed.

## Definition of done (every task)

- Acceptance criteria of the linked FR IDs pass on iOS and Android.
- Works offline where the FR says so.
- Typecheck, lint and tests pass; new RLS rules have pgTAP tests.
- Matches the named design screen (spacing, tokens, copy).
- Accessibility labels present; no hard-coded colors or strings.

## Build order

Follow `docs/tasks.md` top to bottom. Do not start P1 tasks before all P0 tasks are done unless told to.
