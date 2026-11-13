# Plan — User-made sticker packs

Nov 13, 2026. Planning only: nothing here is built yet, and no GitHub issues exist. The product owner asked for a plan for sticker packs uploaded by users; every open decision is listed at the end with a recommended default.

## What the docs say today

Nothing in the source documents covers user-made packs. What they do say:

- **Architecture, §Sticker and profile content:** "Sticker packs are made in-house or by vetted artists, so they skip the queue." User packs end that assumption: their art must go through the same checks as photos.
- **Architecture, §Who can read what:** the sticker catalog is readable by everyone and writable by admins only.
- **Product, §Sticker sets:** artist collabs with a revenue share (the split is an open question there) and optional sponsored packs. No user packs.
- **Requirements:** FR-STK-01 to FR-STK-08 cover free, earned and paid Pickld packs. FR-STK-04 (viewers never pay; anyone who can see a moment sees all its stickers) is the rule user packs must keep. FR-ACC-04 sets the minimum age at 13.
- **Decisions:** D-25 makes `stickers/` art public catalog data, served without a token and cached as immutable for a year. D-40 maps paid packs to store products. D-41 is the photo check (CSAM hash, then OpenAI scores, then a vision second opinion). D-42: stickers are retired, never deleted. D-43: every moderator decision goes through `mod_decide()`.
- **Moderation console design (`design/screens/ModConsole.html`):** the sidebar lists **Sticker packs** between Users and Audit log, with no count and no screen behind it. The product doc lists it in the sidebar too and says nothing more. No issue covers it. This plan gives it a job (task USP-09).
- **AGENTS.md:** only the routes `/stickers/shop`, `/stickers/pack/[slug]` and `/stickers/mine`. Rules 1, 2, 4, 5, 9 and 10 apply directly to uploaded art.

How the current catalog works, which shapes the plan:

- Packs and stickers are rows in `sticker_packs` and `stickers`, added by migrations (latest: 0032 picture stickers and `retired_at`).
- Every sticker's PNG is **bundled in the app** (`apps/mobile/src/features/edit/stickers/stickerArt.ts`, from `assets/stickers/`) and also uploaded to photo storage by `deno task stickers` for the web page.
- A moment stores each sticker by its art key in `edits` (`asset`), checked by a strict pattern `stickers/<pack>/<name>.png` in the app (`edits.ts`) and in the database.
- `pack_usable()` / `sticker_usable()` decide who may add a sticker; `public_sticker_catalog()` serves the art list to the anonymous web page.

User art can't be bundled, can't live under the public immutable `stickers/` prefix (removal has to take effect at once), and needs a new key shape in `edits`.

## What user packs could be

| Level | Who can add the stickers to a moment | Who sees them | New risk | Fit |
| --- | --- | --- | --- | --- |
| 1. Personal | Only the maker | Anyone who can see the moment (FR-STK-04) | Uploaded art needs moderation | **First version** |
| 2. Shared with readers | The maker's readers, after the maker shares the pack | Same | Other people's moments depend on your art; removal and account deletion affect them | Second version |
| 3. Public | Anyone, found through the shop or the maker's profile | Same | Discovery, pack reports, copyright takedowns at scale | Later, only with demand |
| 4. Sold | Buyers | Same | Payouts, tax, creator identity checks, store rules, refunds | Not recommended; use the existing artist-collab path instead |

## Recommended first version

**"My stickers": one personal pack per user, made from their own photos.**

- One pack named by the user (default "Mine"), up to **24 stickers**, matching the 12–24 per pack rule in the product doc.
- A sticker is made from a photo (camera or gallery) cropped to a circle, rounded square or square, or from a PNG that already has transparency, kept as is. Automatic background cut-out is left for later (see open decision 4).
- Only the maker can add their stickers. Anyone who can see a moment sees every sticker on it, as today.
- Every sticker is checked before it can be used, exactly like a photo: status Checking, then usable, queued for a moderator, or removed.
- Free. No store products, no selling, no sharing.

Why this scope: it delivers the "make it mine" feeling, keeps every new risk inside one person's account, needs no payments or legal entity changes, and builds the pieces (upload, moderation, remote art, console section) that levels 2 and 3 reuse.

## User flow and screens

No designs exist for any of these. Each screen is built from the component kit following the nearest design, and each needs a design pass before it is built (task USP-01).

1. **Entry points:** a **+ Make a sticker** tile at the end of the pack tabs in the Stickers tool (pack tab "Mine"), and a **Your stickers** row on My stickers (Settings).
2. **Pick a photo:** Take photo / Choose from gallery (existing camera and `expo-image-picker`).
3. **Shape it** (new screen, nearest design: Crop): pinch and drag inside a circle, rounded square or square mask; a name field (the label, used for search and the screen reader); **Make sticker**.
4. **Checking:** the sticker appears in the "Mine" tab with the same Checking treatment as a photo. It can't be placed until it is usable (most within 10 seconds, FR-SAF-03).
5. **Use it:** placed, moved, resized and rotated like any sticker (FR-CAP-05).
6. **Manage** (new screen, nearest design: My stickers): the pack name, a grid of the user's stickers with status, rename, delete, and the count "8 of 24".
7. **Removed:** a removed sticker shows the reason and **Request a review** (one appeal, FR-SAF-05), reusing the Moment removed notice layout.

Offline: making a sticker queues it like a photo (rule 3); it is usable only after it is checked online.

## Data model (additive only)

New tables, so the existing catalog, its everyone-read policy and the anonymous `public_sticker_catalog()` stay untouched and can't leak a private sticker.

| Table | Columns | Rules |
| --- | --- | --- |
| `user_sticker_packs` | id, owner\_id, name, created\_at, sort | One per owner in v1 (unique owner\_id). Owner reads and writes. |
| `user_stickers` | id, pack\_id, owner\_id, label, asset\_path, source\_path, width, height, status (`moment_status`: uploading, checking, live, removed), created\_at, deleted\_at | Max 24 live or checking per pack (trigger). Only `fn:moderate` sets live or removed (same pattern as moments, rule 4). Owner reads all their rows; others read nothing directly. |
| `moment_user_stickers` | moment\_id, sticker\_id | Kept in step with `moments.edits` by a trigger. Lets the database check who may see a sticker's art, and shows moderators where a sticker is used. |

Changes to existing objects (all additive):

- `moderation_items.user_sticker_id uuid null` (like `comment_id`), and `appeals` accepting it, so stickers use the same queue, decisions and audit log.
- `report_reason` unchanged; `target_type` gains `sticker` only when sharing arrives (level 2). In v1 a bad sticker on a moment is reported by reporting the moment.
- `moments.edits`: a sticker entry may carry `userSticker: <id>` with `asset` matching a new key shape (below). The database trigger that guards edits refuses a user sticker unless the moment's owner owns it and it is live. Removed or deleted stickers stay in `edits` (like retired stickers, D-42) but stop drawing.
- New `can_view_user_sticker(id)`: the sticker is live and either the caller owns it or it appears (through `moment_user_stickers`) on a moment the caller can see under the existing `can_view_jar` rules, never on a private moment (rule 9).
- Account deletion and the data export (FR-PRV-02) include user stickers and their files.

Every new policy and function ships with pgTAP tests as owner, reader, outsider and blocked user (rule 1).

## Storage and image processing

- **Keys:** `user-stickers/<owner id>/<upload id>.png` (processed art) and `user-stickers/<owner id>/<upload id>/source.jpg` (the original, kept for moderation and appeals). A new prefix in `object_keys.ts`; `isStickerKey()` stays for catalog art only.
- **Upload:** the existing `fn:upload-url` gains a `sticker` kind (signed PUT, short-lived). Rate limit: 10 new stickers a day per user.
- **On the phone (before upload):** crop and mask with Skia, export a 512 × 512 px max PNG with transparency, strip all EXIF (rule 5; a sticker keeps no capture time either), and a 480 px JPEG thumbnail on white for the moderation check.
- **Serving:** not public like D-25. The photo worker serves `user-stickers/` keys only with a short-lived token, and `fn:photo-urls` signs a key only when `can_view_user_sticker()` passes. A removed sticker stops loading at once; the phone caches art by key with `expo-image` (FR-STK-02), and drops the cache entry when the sticker is reported removed.
- **Rendering:** the editor, moment view and jar card load user art from the network instead of `stickerArt.ts`, with a neutral placeholder while loading or when unavailable.
- **Web page:** `fn:public-page` signs user sticker keys on Everyone jars the same way it signs photos (D-32).
- **Old app versions:** a version that doesn't know `userSticker` must skip it, not fail to open the moment. Ship the tolerant `edits` parser at least one store release before user stickers go live (task USP-02).
- **Cost:** 24 stickers × about 150 KB plus a source photo is under 10 MB per active maker; negligible next to photos (docs/photo-storage-costs.md).

## Moderation

Uploaded art is treated exactly like a photo, because it is one.

1. **Child safety first.** The CSAM hash match runs on the source photo and the processed PNG. A match goes to `moderation_csam_block()` (D-41, 0040) unchanged in spirit: the sticker is removed, the account suspended with no end date, a `csam_incidents` row keeps the keys, and nothing reaches the console. Anti-OSAEC (RA 11930) and NCMEC reporting duties apply to sticker art as they do to photos.
2. **Scores.** `fn:moderate` gains `{ userStickerId }`: OpenAI `omni-moderation-latest` on the 480 px thumbnail plus the label, a vision second opinion for borderline scores, the same versioned thresholds. Self-harm and sexual/minors are never auto-removed (a human decides).
3. **Extra rule for stickers:** stickers are reused across many moments, so the auto-approve band is stricter than for photos (open decision 6). Anything borderline waits for a moderator.
4. **Strikes and appeals:** a removed sticker counts as a removal for the three-strike rule (D-43) and can be appealed once, decided by a different moderator.
5. **Combination abuse:** a harmless sticker placed to make a photo offensive is handled by reporting the moment. Reports should show moderators the moment drawn with its stickers, not just the clean photo (the console detail panel already blurs the photo; it needs the overlays drawn on top).
6. **Fails closed:** any error leaves the sticker in Checking; the app retries.

### The console's Sticker packs section

Gives the empty sidebar item a job:

- **Queue filter:** sticker items appear in the main queue with source Auto-check, Report or Appeal and a "Sticker" tag; the Sticker packs section opens the same queue filtered to stickers.
- **Pack view:** search by username; a user's pack as a grid (blurred until Show), each sticker's status, scores, and "used on N moments" with links.
- **Actions:** Keep, Remove, Remove and warn, Escalate, all through `mod_decide()` (D-43) and the audit log. No bulk "remove whole pack" in v1; removing each sticker keeps the audit record precise.
- **Catalog packs:** a read-only list of Pickld packs with retire state, so moderators can answer "is this ours?". Editing the catalog stays in migrations.

## Ownership and who can use whose packs

- The maker owns their pack and keeps the rights to their art; the Terms grant Pickld a license to host, check and display it (open decision 8).
- v1: only the maker can add their stickers. Readers see them on moments they can already see, never in their own Stickers tool.
- Viewing follows the moment: a sticker on a private moment, an Only me jar or a jar hidden from a blocked user is never served to them.
- Deleting a sticker or the account removes it from every moment it appears on (it stops drawing). In v1 those moments are all the maker's own.
- **If sharing comes later (level 2):** the maker shares the pack with their readers; a reader who adds it gets an `owned_packs`-style grant. If the maker deletes a sticker or their account, it disappears from readers' moments too (recommended: the art is the maker's personal data, so it goes with them). Blocking revokes the grant both ways.

## Selling and payouts

Not recommended, now or soon. The reasons, for the record:

- Apple and Google require in-app purchase for digital goods, and every price must be a pre-made store product. Per-user packs would need a few generic price-tier products with entitlements decided on our server (possible with RevenueCat, D-40, but more moving parts).
- Paying creators means collecting identity and payout details, withholding and reporting tax in the Philippines (BIR) and elsewhere, handling refunds and chargebacks after payout, and a seller agreement. Pickld would effectively run a marketplace.
- Paid user art attracts copied characters and logos, which raises takedown volume and legal exposure.

If the goal is great paid art, the existing **artist collab** path (vetted artists, `sticker_packs.artist_id`, revenue share agreed off-platform, packs added by migration) already fits and keeps "skip the queue" true for those packs.

## Store-review and legal risks

| Risk | What it requires | Covered by |
| --- | --- | --- |
| Apple 1.2 / Google Play UGC policy | Filtering before display, a way to report, block, act on reports quickly, published contact info | The moderation pipeline, report a moment, block, console; add "Report this sticker" when sharing arrives |
| Child safety (Anti-OSAEC, NCMEC where US rules apply) | Detect, block and report CSAM in any uploaded image | Same CSAM path as photos (D-41); needs PhotoDNA or another approved matcher, still pending |
| Copyright and trademark (IP Code of the Philippines, DMCA for US users) | Terms that forbid uploading others' work, a takedown address and process, repeat-infringer handling | Terms update and a support-email takedown process (USP-11); low volume while packs are personal |
| Other people's faces (Data Privacy Act of 2012) | A sticker of a person is their personal data; honor removal requests | Community guidelines line, report the moment, support process |
| Minors as makers (13–17) | Same checks as adults; no selling or public discovery | v1 scope already excludes both |
| Terms and privacy policy | User content license, rights warranty, sticker data in export and deletion | USP-11, before launch of the feature |
| Old app versions | Must not crash on unknown sticker entries | USP-02 ships a release ahead |

## Task breakdown

Same format as `docs/plan.md`. **S** ≈ half a day, **M** ≈ a day, **L** ≈ a day and over 300 lines. All tasks are P1 and start only after the M6 tasks and the moderation console scaffold (M3-25, merged) are done. No requirement IDs exist yet; USP-01 adds them (proposed FR-STK-09 Make a sticker, FR-STK-10 Manage my stickers, FR-MOD-06 Sticker review).

### USP-01 · Requirements, designs and decision record
- **Area:** design · **Priority:** P1 · **Size:** M · **Requirements:** — · **Depends on:** — · **Issue:** —
- **Goal:** Settle the open decisions below, add the new FR IDs to `docs/requirements.md`, record a decision in `docs/decisions.md` that replaces "sticker packs skip the queue" for user packs, and design the four new screens.
- **Acceptance:**
  - [ ] Open decisions answered or defaults accepted by the product owner.
  - [ ] FR-STK-09, FR-STK-10 and FR-MOD-06 written with acceptance criteria.
  - [ ] Designs for Make a sticker, Checking sticker, Your stickers and Sticker removed, plus the console's Sticker packs section.
- **Tests:** Reviewed by the product owner.
- **Screenshots:** —
- **Design:** Stickers, MyStickers, Crop, ModConsole

### USP-02 · Tolerant sticker entries in edits
- **Area:** app · **Priority:** P1 · **Size:** S · **Requirements:** FR-CAP-08, FR-STK-04 · **Depends on:** — · **Issue:** —
- **Goal:** The app skips a sticker entry it can't draw (unknown key shape or `userSticker`) instead of failing to open the moment. Ships in a store release before USP-06 goes live.
- **Acceptance:**
  - [ ] A moment with an unknown sticker entry opens, draws everything else and re-saves without losing the entry.
- **Tests:** Jest for the `edits` parser with unknown entries.
- **Screenshots:** —
- **Design:** —

### USP-03 · User sticker tables and rules
- **Area:** backend · **Priority:** P1 · **Size:** L · **Requirements:** FR-STK-09 · **Depends on:** USP-01 · **Issue:** —
- **Goal:** Migration with `user_sticker_packs`, `user_stickers`, `moment_user_stickers`, the 24-sticker limit, the edits trigger accepting live owned user stickers, `can_view_user_sticker()`, and `moderation_items.user_sticker_id`.
- **Acceptance:**
  - [ ] Only `fn:moderate`'s database functions can set a sticker live or removed.
  - [ ] A moment can't reference another user's sticker or one that isn't live.
  - [ ] `can_view_user_sticker()` follows `can_view_jar`, private moments and blocks.
- **Tests:** pgTAP as owner, reader, outsider and blocked user; limit and status tests.
- **Screenshots:** —
- **Design:** —

### USP-04 · Upload and serve sticker art
- **Area:** backend · **Priority:** P1 · **Size:** M · **Requirements:** FR-STK-09, FR-STK-02 · **Depends on:** USP-03 · **Issue:** —
- **Goal:** `user-stickers/` keys, a `sticker` kind in `fn:upload-url` with a 10-a-day limit, token-only serving in the photo worker, and `fn:photo-urls` / `fn:public-page` signing only viewable stickers.
- **Acceptance:**
  - [ ] An outsider can't get a URL for a sticker on a moment they can't see.
  - [ ] A removed sticker's URL stops working within the token lifetime.
- **Tests:** Deno tests for the functions and the worker.
- **Screenshots:** —
- **Design:** —

### USP-05 · Moderate stickers
- **Area:** backend · **Priority:** P1 · **Size:** M · **Requirements:** FR-SAF-03, FR-SAF-04, FR-SAF-05, FR-SAF-06 · **Depends on:** USP-03, USP-04 · **Issue:** —
- **Goal:** `fn:moderate` accepts `{ userStickerId }`: CSAM match on source and art, scores on thumbnail plus label, sticker thresholds, queueing, strikes, appeals through `mod_decide()`.
- **Acceptance:**
  - [ ] A hash match blocks the sticker and suspends the account without a queue item.
  - [ ] Borderline stickers queue; removal counts as a strike; one appeal per removal.
  - [ ] Every step fails closed.
- **Tests:** Deno tests with the local provider and hash-list stand-ins; pgTAP for the decision paths.
- **Screenshots:** —
- **Design:** —

### USP-06 · Make a sticker
- **Area:** app · **Priority:** P1 · **Size:** L · **Requirements:** FR-STK-09 · **Depends on:** USP-02, USP-04, USP-05 · **Issue:** —
- **Goal:** Pick a photo, shape it, name it, process it on the phone (512 px PNG, no EXIF, thumbnail), queue it offline, upload and check it.
- **Acceptance:**
  - [ ] The sticker appears in Checking at once, even offline, and becomes usable after the check.
  - [ ] No EXIF in the uploaded files.
- **Tests:** Jest for processing; Maestro flow make → checking → usable.
- **Screenshots:** MakeSticker-ios.png
- **Design:** —

### USP-07 · User stickers in the editor and viewers
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-CAP-05, FR-STK-04 · **Depends on:** USP-06 · **Issue:** —
- **Goal:** "Mine" tab in the Stickers tool; placing a user sticker saves `userSticker` in `edits`; moment view, jar page and jar card draw remote art with a placeholder.
- **Acceptance:**
  - [ ] A reader sees the maker's sticker on a live moment; a blocked user and an outsider don't.
- **Tests:** Jest for the overlay; Maestro two-account check.
- **Screenshots:** Stickers-mine-ios.png
- **Design:** Stickers

### USP-08 · Your stickers screen and removed notice
- **Area:** app · **Priority:** P1 · **Size:** M · **Requirements:** FR-STK-10, FR-SAF-05 · **Depends on:** USP-07 · **Issue:** —
- **Goal:** Rename the pack, rename or delete stickers, see status and the 24 limit; removed stickers show the reason and Request a review.
- **Acceptance:**
  - [ ] Deleting a sticker stops it drawing on every moment.
  - [ ] An appeal can be sent once per removal.
- **Tests:** Jest; Maestro delete and appeal.
- **Screenshots:** YourStickers-ios.png
- **Design:** MyStickers

### USP-09 · Console: Sticker packs section
- **Area:** web · **Priority:** P1 · **Size:** M · **Requirements:** FR-MOD-06, FR-MOD-03, FR-MOD-05 · **Depends on:** USP-05 · **Issue:** —
- **Goal:** Sticker tag and filter in the queue, the per-user pack view with "used on N moments", decisions through `fn:mod-action`, and the read-only catalog list.
- **Acceptance:**
  - [ ] Sticker art is blurred until Show; every decision is in the audit log.
- **Tests:** Console component tests; end-to-end decide on the local stack.
- **Screenshots:** ModConsole-stickers.png
- **Design:** ModConsole

### USP-10 · Reports show stickers on the photo
- **Area:** web · **Priority:** P1 · **Size:** S · **Requirements:** FR-MOD-03 · **Depends on:** USP-09 · **Issue:** —
- **Goal:** The console's detail panel draws a reported moment with its stickers, bubbles and text, so combination abuse is visible.
- **Acceptance:**
  - [ ] A reported moment shows its overlays, still blurred until Show.
- **Tests:** Component test with a sample `edits`.
- **Screenshots:** —
- **Design:** ModConsole

### USP-11 · Terms, guidelines, export and deletion
- **Area:** design · **Priority:** P1 · **Size:** S · **Requirements:** FR-PRV-02 · **Depends on:** USP-01 · **Issue:** —
- **Goal:** Terms add the user content license and rights warranty; community guidelines cover stickers (no others' artwork, logos or other people's faces without consent); a takedown address; data export and account deletion include stickers.
- **Acceptance:**
  - [ ] Legal drafts reviewed by the founders' counsel.
  - [ ] Export contains sticker files; deletion removes them.
- **Tests:** Account-jobs test for export and purge.
- **Screenshots:** —
- **Design:** —

**Estimate:** 11 tasks, about 8–9 working days of build after USP-01, plus design and legal review time. Live child-safety checking still depends on the approved CSAM matcher (D-41).

Order: USP-01 and USP-02 first (USP-02 must reach the stores early) → USP-03 → USP-04 → USP-05 → USP-06 → USP-07 → USP-08; USP-09 and USP-10 can run alongside USP-06–08; USP-11 any time after USP-01, finished before launch.

## Open decisions

| # | Question | Recommended default |
| --- | --- | --- |
| 1 | Which level ships first? | Personal only (level 1) |
| 2 | How many packs and stickers per user? | One pack, 24 stickers |
| 3 | Free or part of a paid plan (Pickld+ later)? | Free in v1; revisit with Pickld+ |
| 4 | Automatic background cut-out? | Not in v1 (shapes only); add later with the on-device subject cut-out on iOS 17+ |
| 5 | Can readers ever add someone's stickers? | Not in v1; level 2 after usage data |
| 6 | Auto-approve band for stickers | Stricter than photos: only "low on everything" goes live; anything else waits for a moderator |
| 7 | Sell user packs? | No; use vetted artist collabs |
| 8 | Who owns the art? | The maker; Pickld gets a hosting and display license in the Terms |
| 9 | When a sticker is removed or deleted, what happens on moments? | It stops drawing; the moment stays |
| 10 | Can 13–17-year-olds make stickers? | Yes, same checks; no sharing or selling for them even later |
| 11 | Launch before the real CSAM matcher is live? | No; the feature stays off in production until the matcher is wired in (same as photos, D-41) |
