# Plan — Invite codes

Nov 14, 2026. Planning only: nothing here is built yet, and no GitHub issues exist. The product owner asked for "invite code" where "each user can invite up to 8 users using their invite link — for virality". Every open decision is listed at the end with a recommended default.

## What the docs and code say today

Nothing in the source documents covers invite codes. What they do say:

- **Product, §Product rules:** "Launch: Global from day one, for everyone." An invite-only start changes this line (open decision 1).
- **Product, §Onboarding and FR-ONB-06:** Find friends (setup step 6 of 6) copies an "invite link" that is just the profile link, `pickld.me/<username>`. FR-SOC-02's empty Jars view has an **Invite friends** action that does the same. Neither tracks who joined.
- **FR-ACC-01 / FR-ACC-02, D-60:** sign-up is Apple, Google or a 6-digit email code; no passwords. `sendEmailCode` creates the auth user only in sign-up mode (`shouldCreateUser`), but Apple and Google create one from either screen.
- **FR-ACC-04, D-85:** the birthday is checked on About you; under 13 shows Under 13, and `fn:account-purge` deletes everything, including the auth record. The profile row (and its 13+ check in Postgres) is created only when About you saves.
- **FR-SOC-07, 0001:** following ("Be a reader") needs no approval; `follows_insert` only checks `reader_id = auth.uid()`. Blocking removes follows both ways (FR-SAF-02, `blocks_sync`).
- **FR-NOT-02, 0019:** a `friend_joined` notification already exists (contact matches, at most one a day) with its own switch in `notification_prefs`.
- **D-33:** the app claims all of `pickld.me` (the AASA file's `/*`), so a new `pickld.me/i/<code>` path already opens the app when it is installed; `src/lib/links.ts` decides where it goes.
- **D-22 and D-41:** the early version must not open to the public until the deferred moderation work ships. D-38 sets the launch load target at about 5,000 daily users.
- **Marketing website (in progress, `feat/marketing-site`, not merged):** migration `0071_waitlist.sql` adds a server-only `waitlist` table (email, source, keyed IP hash, created_at) written by `fn:waitlist-join`, with 5 joins per IP hash an hour. It says nothing about codes; its thread suggested the waitlist "could hand out invite codes at launch".
- **Rate limits already follow one pattern:** `contact_match_take()` (0015) and `waitlist_join()` (0071) count recent calls under an advisory lock. Invites reuse it.

## Recommended shape

**Pickld opens as invite-only early access. Every person gets one personal invite link with 8 seats, one per moment. The waitlist is the second way in. A server switch opens sign-up to everyone later, with no app release.**

Why invite-only first:

- **Virality needs scarcity.** A cap of 8 only means something if a code is needed to get in; with open sign-up, an invite link is just the profile link that already exists.
- **People arrive in friend groups.** Each invitee starts with someone in their feed. The product doc calls an empty Jars feed "the biggest early drop-off risk".
- **A controlled ramp.** Growth is bounded while the moderation console and thresholds settle (D-22) and stays near the load target (D-38).

The cost: people with no friend inside wait on the waitlist, and App Review needs a working code in the review notes. When sign-up opens, invite links keep working: they still make the two people readers of each other and count toward the inviter's 8 (open decision 1).

## How it works

### The invite link and code

- Each profile has one **personal code**: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O, 1/I/L), e.g. `K7M2QX`. About 890 million combinations; guessing is stopped by rate limits, not by length.
- The link is `pickld.me/i/K7M2QX`. Usernames are 3 to 20 characters, so `/i/` can never collide with a profile; `i` still joins the reserved route words for clarity.
- The code doesn't change when the username changes, and never expires while its owner is active.
- **8 seats per person.** A seat is taken when an invitee finishes About you with the code. A code with no free seat says "This invite is used up".
- **Unlock:** a new account's invites unlock after its first live moment (a photo that passed the check), so a throwaway account can't invite. Accounts that exist when this ships are unlocked at once (open decisions 5 and 11).
- **Founders' codes** (`admin` kind): any number of seats and an optional end date, made by a service-role SQL function, for App Review, press and beta testers. They don't make anyone a reader.

### Seats: when they are used and when they come back

| Event                                                                                       | Seat                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Invitee enters the code                                                                     | Held for 24 hours (a **claim**), so two people can't both take the last seat while signing up        |
| Invitee finishes About you                                                                  | Used for good (**joined**)                                                                           |
| Claim not finished within 24 hours                                                          | Comes back                                                                                           |
| Invitee is under 13                                                                         | Comes back at once: the purge deletes the auth record and the claim with it, and no profile was made |
| Invitee uses a different code before finishing                                              | The first claim is released                                                                          |
| Invitee later deletes their account, is blocked by the inviter, or is removed by moderators | **Does not** come back, so seats can't be recycled through throwaway accounts (open decision 3)      |
| Inviter is suspended (7 days, D-10)                                                         | Code paused; pending claims released; works again when the suspension ends                           |
| Inviter deletes their account or is suspended with no end date (D-41)                       | Code stops working for good                                                                          |
| Moderator freezes the inviter's invites                                                     | Code paused until unfrozen                                                                           |

Waitlist codes are single-use and expire after 14 days; the person can ask again from the expired-code page (open decision 6).

### Opening an invite link

**With the app installed:** the universal link opens the app (D-33). `links.ts` maps `/i/<code>` to the new route `/invite/<code>`:

- **Signed out:** Sign up opens with the code filled in and a line "Joff invited you". The code is kept on the phone (key-value storage) until About you saves, so it survives the email-code round trip and Apple or Google sign-in.
- **Signed in:** "You're already on Pickld" and the inviter's profile with Be a reader. Nothing is used.

**Without the app:** the browser shows the invite page on pickld.me (`apps/web`, route `/i/[code]`, built like the shared-link page):

- The inviter's avatar, name and @username (what their public profile already shows; no photos), "Joff invited you to Pickld", "Eight moments. One real day.", the code large, and **Get the app**.
- Get the app copies the code to the clipboard, then opens the App Store (the button stays hidden until `APP_STORE_URL` is set, as on the shared-link page, D-32). A smaller line: "Already have Pickld? Open the app".
- Used up, expired, paused or unknown codes show one generic page: "This invite can't be used" with **Join the waitlist** (or Get the app once sign-up is open). It never says whether the code existed or whose it was.
- Link previews (Open Graph image): the inviter's name and the Pickld jar, no photos.

**Deferred deep link (the code surviving the App Store install):** no vendor such as Branch or AppsFlyer (paid, an SDK and device-matching data to explain in the privacy policy). Instead the page copies the code, and Sign up has an **invite code** field with a **Paste** button (iOS asks once to allow pasting). Android, when it comes, can read the Play Install Referrer for free (open decision 7).

### Signing up with a code

1. **Sign up** gains the invite code field above Apple, Google and email, filled from a link or pasted. While invites are required, the buttons stay disabled until the code checks out ("Joff's invite · 5 seats left"); a wrong code shows "That code doesn't work" and **Join the waitlist**. With open sign-up the field is optional and folded behind "Have an invite code?".
2. After Apple, Google or the email code, the app **claims** the code for the new auth user (seat held).
3. **About you** is unchanged. Saving the profile turns the claim into a join in the same database transaction, makes the two people readers (below) and notifies the inviter. Under 13 behaves exactly as today and uses no seat.
4. **The gate lives in Postgres** (rule 1): while invites are required, a profile insert without a live claim is refused. The app sends a signed-in person with no profile and no claim (for example a new Apple account opened from Sign in) to an **Enter invite code** screen instead of About you.
5. **Sign in** for existing accounts never asks for a code.

### Readers

On join, **the inviter and the invitee read each other**, with one exception: if the invitee is 13 to 17, only the invitee reads the inviter. Follows need no approval anyway (FR-SOC-07), so this doesn't open anything a tap couldn't, but Pickld shouldn't put a minor in someone's readers on its own (open decision 4).

- About you shows "You and Joff will read each other. You can change this anytime." (or "You'll read Joff" for 13–17).
- The two automatic follows don't send "new reader" notifications; the inviter gets one **"Ana joined with your invite"** notification (new type `invite_joined`, using the existing Friend joined switch, so Settings doesn't change). The invitee sees the inviter's jars in their feed from the first launch.
- Either side can stop reading or block as usual; blocking removes both follows (FR-SAF-02).

### What the inviter sees

A new **Invite friends** screen (`/invite`), opened from Find friends (setup), the empty Jars view's Invite friends, a row on your profile ("Invite friends · 5 left") and Settings:

- A 2 by 4 grid like Today's: one tile per seat. A joined friend's tile shows their avatar and name and opens their profile; a held seat shows "Joining…"; a free one shows "Invite". Above it: "5 of 8 invites left".
- The link and code, **Copy link**, **Share** (the system sheet, with a ready message: "Join me on Pickld, 8 moments a day: pickld.me/i/K7M2QX"), and the code on its own for saying aloud.
- Before unlocking: the grid greyed with "Add your first moment to unlock your 8 invites".
- People blocked either way show as a plain "Joined" tile with no name (the seat stays used).
- Find friends' current "Invite with your link pickld.me/dale" row becomes this link with the seats left.

### Waitlist

The marketing site's waitlist becomes the second way in:

- Founders release the waitlist in batches, oldest first: `waitlist_release(n)` (service role) creates one single-use `waitlist` code per email, expiring in 14 days, and marks the row `invited_at`.
- An email per person with the code and the link, sent by a transactional email provider (the founders' choice; Supabase Auth's mail is for sign-in codes only). Until that exists, a founder can export the batch and send it by hand.
- A waitlist code works for whoever has it (not tied to the email), because Apple's Hide My Email gives a different address. It makes no one a reader.
- When the person signs up, their waitlist row gets `joined_at` (matched by code), for the founders' numbers.
- Expired codes can be released again; joining the waitlist twice stays one row (0071).

### Abuse limits

| Risk                                        | Limit                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guessing codes                              | Checking a code is anonymous through `fn:invite` with a keyed IP hash, 20 checks an hour per hash; claiming is 10 tries an hour per user; both use the 0015 pattern                                                                                                                    |
| Throwaway accounts inviting more throwaways | Invites unlock after the first live moment; each account still needs its own email or Apple or Google account                                                                                                                                                                          |
| An inviter bringing in bad actors           | The invite tree is kept (`invite_redemptions`). Moderators see "invited by" and "invited N" in the console and can freeze someone's invites; when 3 of a person's invitees are suspended within 90 days, their remaining invites freeze automatically pending review (open decision 9) |
| Blocked users                               | Block works as today after joining. Invite lists hide blocked people's names both ways. A blocked person can't be "uninvited" (the seat stays used)                                                                                                                                    |
| Suspended or removed accounts               | An inactive inviter's code stops working (table above). A suspended invitee changes nothing for the inviter unless the freeze rule triggers                                                                                                                                            |
| Under 13                                    | Uses no seat, keeps nothing (FR-ACC-04 unchanged)                                                                                                                                                                                                                                      |
| Codes sold or posted publicly               | A personal code tops out at 8 joins; waitlist codes are single-use and expire; founders can freeze any code                                                                                                                                                                            |
| Codes in analytics                          | Never sent (rule 10 spirit: a code is a bearer secret). Events carry only outcomes: `invite_shared`, `invite_page_opened`, `invite_claimed { outcome }`, `invite_joined`                                                                                                               |

## Data model (additive only)

One migration after the waitlist's `0071` (likely `0072_invites.sql`). Nothing dropped or renamed.

| Object               | Columns / behavior                                                                                                                                                                                              | Rules                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invite_kind` enum   | `personal`, `waitlist`, `admin`                                                                                                                                                                                 | —                                                                                                                                                                                                                                     |
| `invite_codes`       | code (citext pk, the 6-character alphabet), kind, owner\_id (profiles, null for waitlist and admin), seats (8 for personal, 1 for waitlist), expires\_at, unlocked\_at, frozen\_at, frozen\_reason, created\_at | One personal code per profile (partial unique index), made by a trigger when the profile is inserted; existing profiles get one (unlocked) in the migration. No direct client reads or writes; everything through the functions below |
| `invite_redemptions` | id, code, invitee\_id (auth.users, unique: one invite per account), status (`claimed`, `joined`), claimed\_at, hold\_until, joined\_at                                                                          | Cascades with the auth user, so the Under 13 purge releases a claim. Seats in use = joined + claimed with `hold_until` in the future. No direct client access                                                                         |
| `invite_attempts`    | key (user id or IP hash), created\_at                                                                                                                                                                           | The rate limit table, like `contact_match_calls`; old rows swept by `fn:account-jobs`                                                                                                                                                 |
| `app_settings`       | single row: `signup_requires_invite boolean`                                                                                                                                                                    | Readable by anyone through `signup_requires_invite()`; changed only by the service role (a founder, in SQL or a runbook step)                                                                                                         |
| `waitlist` (0071)    | add `invite_code` (references invite\_codes), `invited_at`, `joined_at`                                                                                                                                         | Still service-role only                                                                                                                                                                                                               |
| `notifications`      | type `invite_joined` added to the allowed types                                                                                                                                                                 | Same push path, quiet hours and Friend joined switch                                                                                                                                                                                  |
| `reserved_usernames` | add `i`, `invite`                                                                                                                                                                                               | —                                                                                                                                                                                                                                     |

### Functions

| Function                                                | Who calls it                                             | Does                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invite_preview(code, ip_hash)`                         | `fn:invite` (service role), for the web page and Sign up | Rate-limits by IP hash; returns `ok` with the inviter's username, display name, avatar key and seats left, or one `unavailable` for every other case                                                                                                     |
| `invite_claim(code)`                                    | Signed-in user without a profile                         | `claimed`, `unavailable`, `limited` or `already_member`; takes an advisory lock on the code so two claims can't take the last seat; releases the caller's earlier claim                                                                                  |
| `invite_release()`                                      | Signed-in user without a profile                         | Drops their claim                                                                                                                                                                                                                                        |
| `signup_requires_invite()`                              | Anyone (anon)                                            | The switch, so the app can show the field as required or optional                                                                                                                                                                                        |
| profile insert trigger                                  | —                                                        | With the switch on, refuses a profile without a live claim; turns the claim into a join; makes the follows (age rule) without new-reader rows; adds the `invite_joined` notification; with the switch off, a claim is still honored and no claim is fine |
| `my_invites()`                                          | Signed-in user                                           | Their code, link parts, seats, used, held, left, unlocked, and the joined people (id, username, display name, avatar key, joined\_at), names hidden for blocks either way                                                                                |
| unlock trigger on moments                               | —                                                        | Sets `unlocked_at` on the owner's code when their first moment goes live                                                                                                                                                                                 |
| `invite_freeze(user, reason)` / `invite_unfreeze(user)` | `fn:mod-action` through `mod_decide()`                   | With an audit row (D-43); plus the automatic 3-suspended-invitees rule inside the suspension path                                                                                                                                                        |
| `admin_invite_create(seats, expires_at)`                | Service role only                                        | Founders' codes                                                                                                                                                                                                                                          |
| `waitlist_release(n)`                                   | Service role only                                        | Creates and records waitlist codes for the oldest n not yet invited                                                                                                                                                                                      |

### pgTAP coverage (rule 1)

`supabase/tests/invites.sql`, as owner, reader, outsider and blocked user where it applies:

- No role but the service role can select, insert, update or delete `invite_codes`, `invite_redemptions`, `invite_attempts` or `app_settings`; anon can call only `signup_requires_invite()`.
- Claim: unknown, expired, frozen, paused (suspended or deleted owner), full and locked codes return `unavailable`; an existing member gets `already_member`; the 11th try in an hour gets `limited`.
- Seats: 8 joins fill a code; a ninth claim fails; a lapsed hold frees its seat; two claims racing for the last seat leave exactly one; purging an auth user with a claim frees the seat; deleting a joined invitee doesn't.
- Gate: with the switch on, a profile insert without a claim fails and with one succeeds; with it off, both succeed; a 12-year-old's insert still fails and keeps the seat free.
- Join: adult invitee gives two follows, a 15-year-old one; no `new_reader` rows; one `invite_joined` row for the inviter.
- `my_invites()` shows only the caller's own invitees and hides names across a block; an outsider can't see who someone invited.
- Unlock on first live moment; freeze and unfreeze only through `mod_decide()` with audit rows; the automatic freeze at 3 suspended invitees.
- `waitlist_release()` makes single-use codes and marks rows once.

## Screens

| Screen                                         | Change                                                                                                                                    | Design                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Sign up                                        | Invite code field with Paste, the "Joff invited you" line, disabled buttons until a code checks out (invite-only), Join the waitlist link | `SignUp.html` needs a new state                      |
| Enter invite code (new)                        | For a signed-in person with no profile and no claim                                                                                       | **New design** (nearest: Check your email)           |
| About you                                      | One line about reading each other                                                                                                         | `About.html`, copy only                              |
| Find friends                                   | The invite row shows the invite link and seats left; opens Invite friends                                                                 | `FindFriends.html`, small change                     |
| Invite friends (new, `/invite`)                | Seat grid, link, Copy, Share, locked state                                                                                                | **New design** (nearest: Today's grid, Find friends) |
| Already on Pickld (`/invite/<code>` signed in) | Short notice plus the inviter's profile                                                                                                   | Reuse Other profile with a banner; no new design     |
| Jars, empty                                    | Invite friends opens Invite friends                                                                                                       | `EmptyStories.html`, behavior only                   |
| My profile and Settings                        | "Invite friends · 5 left" row                                                                                                             | `Profile.html`, `Settings.html`, one row each        |
| Notifications                                  | "Ana joined with your invite" row and push                                                                                                | `Notifications.html`, copy only                      |
| Web invite page (`pickld.me/i/<code>`)         | Inviter card, code, Get the app, Open the app; the "can't be used" state with Join the waitlist                                           | **New design** (nearest: `WebShare.html`)            |
| Moderation console                             | Invited by / invited N on a user, Freeze invites                                                                                          | `ModConsole.html`, small addition                    |

Three new designs: **Invite friends**, **Enter invite code** and the **web invite page** (with its "can't be used" state), plus the new Sign up state.

## Task breakdown

Same format as `docs/plan.md`. **S** ≈ half a day, **M** ≈ a day, **L** ≈ a day and over 300 lines. Proposed requirement IDs (added in INV-01): FR-INV-01 Personal invite link, FR-INV-02 Sign up with a code, FR-INV-03 Invite friends screen, FR-INV-04 Waitlist codes, FR-INV-05 Invite limits, FR-WEB-04 Invite page.

### INV-01 · Requirements, designs and decision record

- **Area:** design · **Priority:** P0 if invite-only at launch, else P1 · **Size:** M · **Requirements:** — · **Depends on:** — · **Issue:** —
- **Goal:** Settle the open decisions, add FR-INV-01 to FR-INV-05 and FR-WEB-04, record the decisions (and update product.md's Launch row if invite-only), and design the three new screens and the Sign up state.
- **Acceptance:** decisions answered or defaults accepted; FR IDs with acceptance criteria; designs in `design/screens/`.
- **Tests:** reviewed by the product owner.
- **Design:** SignUp, FindFriends, WebShare, Main

### INV-02 · Invite tables, gate and functions

- **Area:** backend · **Priority:** as INV-01 · **Size:** L · **Requirements:** FR-INV-01, FR-INV-02, FR-INV-05 · **Depends on:** INV-01, the waitlist migration (0071) merged · **Issue:** —
- **Goal:** The migration above: tables, switch, profile-insert gate and join, follows, notification, unlock, rate limits, `my_invites()`, admin and waitlist functions.
- **Acceptance:** every rule in the pgTAP list holds.
- **Tests:** `supabase/tests/invites.sql`.

### INV-03 · Edge Function: invite

- **Area:** backend · **Priority:** as INV-01 · **Size:** S · **Requirements:** FR-INV-02, FR-WEB-04 · **Depends on:** INV-02 · **Issue:** —
- **Goal:** `fn:invite` (anon) checks a code with a keyed IP hash (as `fn:waitlist-join`) and returns the preview and a signed avatar URL; Zod input; `{ data } | { error }`.
- **Tests:** Deno tests: valid, unavailable, limited, bad input.

### INV-04 · Web invite page

- **Area:** web · **Priority:** as INV-01 · **Size:** M · **Requirements:** FR-WEB-04, FR-WEB-03 · **Depends on:** INV-03 · **Issue:** —
- **Goal:** `apps/web` route `/i/[code]` with the inviter card, copy-and-open App Store, Open the app, the "can't be used" state linking to the waitlist, and an Open Graph image without photos.
- **Tests:** web tests for each state; no photo key in the response.

### INV-05 · Sign up with a code

- **Area:** app · **Priority:** as INV-01 · **Size:** M · **Requirements:** FR-INV-02, FR-ACC-01 · **Depends on:** INV-03 · **Issue:** —
- **Goal:** `/i/<code>` in `links.ts` → `/invite/<code>`; the code kept on the phone; Sign up's field with Paste; claim after auth; Enter invite code for signed-in people without a profile or claim; About you's reading line; signed-in "already on Pickld".
- **Tests:** Jest for `links.ts` and the code store; Maestro: link → sign up → About you → joined, and Under 13 using no seat.

### INV-06 · Invite friends screen and entry points

- **Area:** app · **Priority:** as INV-01 · **Size:** M · **Requirements:** FR-INV-03, FR-ONB-06, FR-SOC-02 · **Depends on:** INV-02 · **Issue:** —
- **Goal:** `/invite` with the seat grid, link, Copy, Share and locked state; Find friends, Jars empty, profile and Settings rows.
- **Tests:** Jest for the view states; accessibility labels on every tile.
- **Screenshots:** InviteFriends-ios.png

### INV-07 · Invite joined notification

- **Area:** backend · **Priority:** as INV-01 · **Size:** S · **Requirements:** FR-NOT-02 · **Depends on:** INV-02 · **Issue:** —
- **Goal:** `invite_joined` in `fn:send-push` messages and the Notifications screen, opening the invitee's profile; respects the Friend joined switch and quiet hours.
- **Tests:** `send_push_test.ts`; Jest for the row.

### INV-08 · Waitlist codes

- **Area:** backend · **Priority:** as INV-01 · **Size:** M · **Requirements:** FR-INV-04 · **Depends on:** INV-02, an email provider · **Issue:** —
- **Goal:** `waitlist_release(n)`, a runbook for releasing a batch, the invite email (template in the email-templates style), and `joined_at` on sign-up.
- **Tests:** pgTAP for release; Deno test for the sender with a stub provider.

### INV-09 · Console: invite tree and freeze

- **Area:** web · **Priority:** P1 · **Size:** S · **Requirements:** FR-INV-05, FR-MOD-04, FR-MOD-05 · **Depends on:** INV-02 · **Issue:** —
- **Goal:** "Invited by" and "Invited N" on a user, Freeze and Unfreeze invites through `fn:mod-action`, the automatic freeze shown with its reason.
- **Tests:** console component tests; audit row per action.

### INV-10 · Invite funnel analytics

- **Area:** app · **Priority:** as INV-01 · **Size:** S · **Requirements:** NFR-ANL-01 · **Depends on:** INV-05, INV-06 · **Issue:** —
- **Goal:** the four allowlisted events above, never a code or name; a PostHog funnel link → claim → join.
- **Tests:** the analytics allowlist test.

### INV-11 · Store review and legal

- **Area:** design · **Priority:** as INV-01 · **Size:** S · **Requirements:** FR-PRV-04 · **Depends on:** INV-01 · **Issue:** —
- **Goal:** an admin code in the App Review notes; Privacy policy says who invited whom is stored and shown to moderators; the data export lists the person's invite code and who joined with it.
- **Tests:** export test includes invites.

**Estimate:** 11 tasks, about 7 to 8 working days of build after INV-01, plus design time and the email provider. Order: INV-01 → INV-02 → INV-03 and INV-06 and INV-07 alongside → INV-04 and INV-05 → INV-08 → INV-10; INV-09 after the console's user view; INV-11 before launch.

## Open decisions

| #   | Question                                                        | Recommended default                                                                                                                                               |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Invite-only at launch, or invites optional?                     | Invite-only early access, with the waitlist as the other way in; a server switch opens sign-up later without an app release; invite links keep working afterwards |
| 2   | One personal link with 8 seats, or 8 separate single-use codes? | One personal link and code, 8 seats                                                                                                                               |
| 3   | When is a seat used, and does it ever come back?                | Used when the invitee finishes About you; held 24 hours on claim; returned for under-13s and unfinished claims only, never after a real sign-up                   |
| 4   | Do inviter and invitee read each other automatically?           | Yes, both ways; if the invitee is 13 to 17, only the invitee reads the inviter                                                                                    |
| 5   | When do a new account's invites unlock?                         | After its first live moment                                                                                                                                       |
| 6   | How does the waitlist hand out codes?                           | Founders release batches oldest first; single-use codes by email, expiring in 14 days, not tied to the email; the founders choose the email provider              |
| 7   | Deferred deep link vendor (Branch, AppsFlyer)?                  | No; the web page copies the code and Sign up has a Paste button; Play Install Referrer when Android comes                                                         |
| 8   | A reward for inviting?                                          | Two earned stickers through the milestone system: first friend joined, and all 8 joined ("Full jar of friends")                                                   |
| 9   | Automatic freeze for bad inviters?                              | Freeze remaining invites when 3 invitees are suspended within 90 days; moderators can freeze and unfreeze any time                                                |
| 10  | Founders' codes?                                                | Yes: admin codes with any seat count and an optional end date, for App Review, press and testers                                                                  |
| 11  | Do accounts that exist today get invites?                       | Yes, 8 each, unlocked at once                                                                                                                                     |
