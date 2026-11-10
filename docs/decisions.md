# Pickld 2.0 — Decisions log

Each entry records a decision, who made it, and where it came from. Document conflicts are resolved in favour of `AGENTS.md` and `docs/requirements.md` (brief, ground rules). Details and reasoning for D-1 to D-18 are in `docs/analysis.md` §4.

## Nov 10, 2026 — Phase 1 decisions

jofftiquez (product owner) approved Phase 1 and accepted every recommended default ("Approved, use all defaults").

| # | Decision |
| --- | --- |
| D-1 | **Westward travel:** add a server-set `jars.ends_at`. When a new jar would collide with an existing jar on the same `local_date`, the server re-zones the open jar to the phone's zone and moves `ends_at` later (never earlier). Moments in the extra hours aren't badged "Added later". |
| D-2 | **Offline uploads after midnight:** FR-JAR-06 stays strict. `added_at` is server time only, so a moment captured offline before midnight and uploaded after it shows "Added later". |
| D-3 | **Moving moments:** FR-CAP-10 as written, so moves are only to an empty slot in the same jar. The architecture's "move to yesterday" edge case isn't built; users delete and re-add through My days → Fill this jar. |
| D-4 | **Contact matching:** keyed (server-side HMAC) hashes of contacts' email addresses and phone numbers, matched against users' sign-up emails. No phone collection or SMS verification. |
| D-5 | **Jars, empty:** "Find people" opens Find friends until Explore ships in M6, and suggestions show contact matches only. |
| D-6 | **Premium stickers at launch:** locked packs, the shop banner and the Settings → My stickers row are hidden until M6. |
| D-7 | **Gender-neutral copy:** buttons read "Read" / "Read back" / "Reading"; the web page reads "Dale shared a Sunday jar". |
| D-8 | **Milestones:** the five FR-STK-05 milestones (first full jar, 7 full jars, 30 jars, 100 jars, 1 year). No "Pickld OG" at launch. |
| D-9 | **Jar counts:** others see `visible_count` (live, non-private moments). The owner's count (Today, Full jar, milestones, profile jar count) includes every moment that isn't removed. |
| D-10 | **Strikes:** every removal still standing counts, whether automatic, Remove or Remove and warn. An appeal that overturns the removal clears its strike. Three strikes in 90 days suspends the account for 7 days. |
| D-11 | **Suspended users:** for the 7 days, others can't see their content and they can't write anything. The owner sees a suspension notice and can still view their own data. |
| D-12 | **Photo delivery:** every photo is served through a Cloudflare Worker in front of R2 that checks a short-lived HMAC token issued by `fn:photo-urls` after a visibility check. There are no permanent public photo URLs. |
| D-13 | **Second-opinion vision AI:** an OpenAI vision model, called only for borderline moderation scores. |
| D-14 | **Accounts and credentials:** everything is built and tested against local services first (local Supabase, a local S3-compatible bucket, a stubbed moderation provider). The founders create the vendor accounts and add keys as Amp secrets when an integration task needs them. |
| D-15 | **Android:** milestone reports include iOS Simulator screenshots. Android screenshots only if an Android device or runner is connected or EAS-hosted runs are approved; otherwise reports mark them "not captured". |
| D-16 | **Merging:** I squash-merge my own PRs into `main` once CI passes, and the product owner reviews at each milestone stop. The handoff and Phase 1–2 docs are pushed to `main` at the start of Phase 3. |
| D-17 | **Tab name:** keep "My days". |
| D-18 | **Explore (P1):** Everyone jars appear by default. |

## Document conflicts resolved without a product decision

| # | Conflict | Resolution |
| --- | --- | --- |
| C-1 | Milestone list differs between FR-STK-05, the product pack catalog and the architecture trigger. | FR-STK-05 wins (see D-8). |
| C-2 | Link format: `pickld.me/username` (FR-ONB-06, FR-SOC-10) vs. `pickld.me/u/<username>` (architecture). | FR wins: `pickld.me/<username>` is canonical, jar links are `pickld.me/j/<id>`, and `/u/<username>` redirects. Route words are reserved as usernames. |
| C-3 | Email sign-up goes straight to About you (product) vs. one-tap email link (FR-ACC-01). | FR wins: email → Check your email → link → About you. |
| C-4 | Moments start as `checking` (AGENTS rule 4) vs. schema default `uploading`. | The row is inserted after the upload with status `checking`. `uploading` is kept for the server-side Replace flow, and nothing is renamed. |
| C-5 | `0001_init.sql` security defects (analysis §2.3, S-1 to S-15). | 0001 stays as delivered, and fixes land as additive migrations (0002+) with pgTAP tests. No column is dropped or renamed. |
| C-6 | Sticker catalog and Everyone jars must render on the anonymous web page, but RLS requires a signed-in user and rule 2 forbids a service key in web pages. | Narrow `security definer` RPCs callable with the anon key return Everyone, live, non-private data only. |
