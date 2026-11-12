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

## Nov 10, 2026 — During Phase 4

| # | Decision |
| --- | --- |
| D-19 | **GitHub Actions is blocked by the account's billing** ("recent account payments have failed or your spending limit needs to be increased"). The `ci` workflow is merged and starts working once billing is fixed. Until then, every PR runs `scripts/ci.sh` (the same steps) in the orb before merging, and the PR says so. Owner action: fix billing at github.com/settings/billing. |
| D-20 | **Squash-merge without required checks** while D-19 lasts. Branch protection requiring `ci` is turned on once Actions runs. |
| D-21 | **Repo made public (Nov 10) to get GitHub Actions running.** This supersedes D-19: the `ci` workflow ran green on main (run 42843763954, ~5 min). Every PR now waits for a green `ci` check before it's merged. Branch protection and GitHub secret scanning couldn't be switched on because the agent's token lacks admin rights, so the founder should enable both in Settings (Branches → require `ci`; Code security → secret scanning + push protection). A scan of the full history before going public found no keys, tokens, private keys or `.env` files. Secrets live only in Amp secrets or vendor dashboards, never in the repo. Local Supabase keys are read at runtime from `supabase status`. |

## Nov 11, 2026 — After M1

| # | Decision |
| --- | --- |
| D-22 | **Early version: photos stay on local Supabase Storage and there is no moderation** (product owner, Nov 11). Photos use the local S3-compatible bucket that M1-14/M1-15 already target; R2 and the Cloudflare worker wait for the vendor accounts. `fn:moderate` auto-approves: moments still start as `checking` and only that function sets `live`, so the full pipeline can drop in without schema or app changes. Comments, usernames and bios auto-pass (reserved usernames are still refused). Deferred to the **Before public launch** milestone: M2-20 child-safety match and second opinion (#49), M3-23 mod-action, strikes and suspension (#84), M3-24 appeal screens (#85), M3-25 to M3-28 moderation console and playbook (#86–#89), M5-05 threshold tuning (#118), and the queue-age alert in #110. Kept: block, and report (M3-20/M3-21), because app stores require both for user-generated content; reports are stored and read in Studio until the console exists. The early version must not open to the public until the deferred work ships. |

## Nov 11, 2026 — During M2

| # | Decision |
| --- | --- |
| D-23 | **`expo-network` added** (product owner, Nov 11). It reports the device's connection: the upload worker starts as soon as the connection returns, and the offline banner also shows when the device has no connection. The latest-request signal from M2-06 stays for Wi-Fi without internet or an unreachable backend. |
| D-24 | **Offline time doesn't use up retries** (product owner: "keep it as offline with retry"). A request that never reached the server puts the photo back in the queue without counting an attempt, tries again every 30 s while the phone says it is online, and goes at once on reconnect. Photos that already ran out of attempts on network errors restart from attempt 0 on reconnect. Only server errors count toward the 5 attempts (1 s, 5 s, 30 s, 2 min, 10 min) that end in Retry. |
| D-25 | **Sticker art is public catalog data** (product owner, Nov 11), an exception to D-12 for `stickers/` keys only. The photo worker serves sticker art without a token, cached as immutable for a year, because the editor, viewers and the anonymous web page all draw it. User photos still need a short-lived token. |
| D-26 | **`expo-image-picker` added** (product owner, Nov 11) for "Choose from gallery" and the Crop screen (M2-08, M2-10). Expo's standard picker, free. |
| D-27 | **A removed photo's slot can be filled again** (product owner, Nov 11). The one-moment-per-slot rule ignores removed moments (a partial unique index replacing the plain `unique (jar_id, slot)`; no column dropped or renamed). Removed rows stay for the moderation and appeal record. The same rule leaves room for Replace (M2-22) to keep the old photo visible until the new one is live. |

## Nov 12, 2026 — M3 approval

| # | Decision |
| --- | --- |
| D-28 | **`expo-contacts` added** (product owner, Nov 12, approving the M3 report). Expo's free contacts module, for "People you may know" on Jars, empty (M3-06) and Find friends (M4-08). The address book never leaves the phone: numbers and emails are normalised and hashed on the device and only the hashes go to `fn:contacts-match` (D-4). |
| D-29 | **No likes on comments** (product owner, Nov 12). The heart on each comment in the Comments design is dropped; `reactions.target` stays jar and moment. |
| D-30 | **No notification to reporters about a moderator's decision** for now (M3 report question left unanswered; the existing default stands). Report sent doesn't promise one. |
