# Plan — QA round 1 (iPhone test, Nov 13)

Nov 13, 2026. Planning only: nothing here is built yet. The product owner tested "Pickld Local" on his iPhone against the Mac's local Supabase and sent 18 items, then added item 19 (email sign-in with a code). Each item below says what happens today and why, the proposed change, what it touches, which design screens change, the risks and a rough size. The work is grouped into pieces that ship separately, in order, with the pieces that can run at the same time marked. Open decisions are at the end, each with a recommendation.

Sizes: **S** is under half a day, **M** is 1–2 days, **L** is 3–5 days. iOS only.

## Summary

- **Two real bugs, both found:**
  - **Profile photo upload (1):** the app refuses its own avatar file because of a too-strict location check.
  - **Onboarding back swipe (13):** setup leaves its screens in the navigation history under Today.
  - Both are small fixes and ship first.
- **Three items change product rules and the schema (2, 7, 9):**
  - Moments get their own visibility, so they can be seen before the jar is published.
  - A new Moments timeline.
  - Comment threads on moments.
  - Your own moments and jars appear in both timelines.
  - Moment likes already exist in the database and on Moment detail.
- **Item 8 needs no change:** the Jars timeline already shows only published jars.
- **The rest is UI work:** navigation, the editor, the camera, the day page, the cover photo, Liquid Glass and animations.
- **Email sign-in switches from a link to a 6-digit code (19).** No schema change. The app, the moderation console, the dev sign-in script and the Mac's sign-in helper page must switch in the same release as the email templates, because the templates are shared.

## Root causes of the two bugs

### 1. Uploading a profile photo fails

**What happens:** Change avatar or Change cover (Edit profile), and the photo on About you during setup, show the upload error. No request reaches the server. The local functions log has no `upload-url` call for an avatar from the phone, and storage holds no avatar or cover objects for his account.

**Why:**

- `prepareProfileImage` (`apps/mobile/src/lib/image/profileImage.ts`) re-encodes the photo as JPEG with `expo-image-manipulator`. On iOS that calls `UIImage.jpegData`.
- Apple's JPEG encoder always writes a Photoshop **APP13** segment.
- The location check `assertNoLocationMetadata` (`src/lib/image/exif.ts`, `readJpeg`) treats **any** APP13 segment as IPTC location data (`out.locationTags.push('IPTC')`). It throws `LocationMetadataError`, the screen catches it and shows "upload".
- Moment photos are encoded as **WebP**, which has no APP13, so moments upload fine. Only avatars and covers use JPEG: the `profiles` checks require a `.jpg` key.

**Evidence:**

- I encoded a 512×512 image with `UIImage.jpegData` in the iOS 26.2 Simulator and ran the app's checker on it. The JPEG fails with "location metadata: IPTC"; the PNG passes.
- The APP13 segment Apple writes holds only an **empty** IPTC record (`8BIM 0x0404`, length 0) and its checksum (`8BIM 0x0425`, the MD5 of nothing, `d41d8cd9…`). It contains no location.
- The server side works: a signed `fn:upload-url` request for an avatar followed by the PUT returned 200 locally. I deleted the test object afterwards.

**Fix (S):**

- Make the APP13 check exact without weakening it. Parse the Photoshop resource blocks and flag the file only when the IPTC resource (`0x0404`) has data, or when the block can't be parsed (it still fails closed).
- Add a unit test with the exact bytes iOS writes, plus tests that an IPTC block with a City dataset and a malformed block are still refused.
- Rule 5 (strip location) still holds: the re-encode keeps nothing from the source, and the check still reads every container.

**Touches:** `src/lib/image/exif.ts` and its tests. No schema or server change.

### 13. Swiping back after onboarding returns to onboarding

**What happens:** After the Pickld Promise, Today opens. An iOS back swipe goes back to Find friends, then Permissions, and so on.

**Why:**

- Every onboarding step adds a screen to the root Stack (`router.push(next)`): Welcome → Intro 1–3 → Sign up → Check email → … → Friends.
- The last step calls `router.replace('/')` (`PromiseScreen.tsx`), and `app/index.tsx` then `<Redirect>`s to Today. `replace` swaps out **only the top screen**, so Welcome, Intro, Sign up, Check email and the setup steps all stay underneath Today.
- The same happens after a plain sign-in: the auth screens' `<Redirect href="/">` leaves Welcome → Sign in → Check email under Today.

**Fix (S–M):**

- Guard the route groups with Expo Router's `Stack.Protected`, which the installed `expo-router` 58 supports:
  - signed-out screens are reachable only when signed out;
  - setup screens only while setup is unfinished;
  - the app screens only when signed in with setup done.
- When the guard flips, Expo Router removes the screens that are no longer allowed from the history, so a back swipe has nothing to return to. Sign-out gets the same treatment in reverse.
- As a fallback the last step also calls `router.dismissAll()` before replacing.
- Add a Maestro check to the onboarding flow: finish setup, swipe back, Today is still showing.

**Touches:** `app/_layout.tsx` (group the screens), `app/index.tsx`, the onboarding screens' last-step navigation, `useAuthStore` / `setupFlow` (one "setup done" value the guard reads). No schema change.

## Item by item

### 2. A Moments timeline, with likes and comments on both moments and jars

**Today:**

- One timeline, Jars (`feed_page`, 0014), with published jars from people you read.
- Likes on moments already exist: `reactions.target` allows `jar` and `moment`, there is `moments.like_count`, and Moment detail has a heart.
- Comments belong to a jar only (`comments.jar_id`, no moment column). Moment detail's comment button opens the **jar's** thread.

**Change:**

- **Moments timeline:**
  - A new tab and `moments_feed_page(cursor_at, cursor_id)`: live moments the viewer is allowed to see (item 7) from people they read plus their own (item 9), newest `added_at` first, 20 per page, same cursor style as `feed_page`.
  - Each card shows the author, the slot hashtag, the time, the 3:4 photo with its edits, the caption, a like button and a comment count.
  - Tapping the card opens that moment's detail. "View jar" shows only when its jar is published and visible to the viewer.
- **Moment comments:**
  - `comments.moment_id uuid null references moments on delete cascade`. A comment with no `moment_id` belongs to the jar thread; one with a `moment_id` belongs to that moment's thread.
  - `jar_id` stays filled (the moment's jar), so cascade deletes, moderation and reports keep working.
  - New `moments.comment_count`. `jars.comment_count` counts only the jar thread.
  - RLS: select and insert check `can_view_moment` for a moment comment and `can_view_jar` for a jar comment.
  - Notifications: a "comment" or "reply" on a moment carries `moment_id` (the column exists) and says "commented on your moment".
  - Route: `/comments/[jarId]?momentId=…`, so the screen and its hooks are reused.
- Existing comments stay in their jar threads. D-29 (no likes on comments) is unchanged.

**Touches:**

- Migrations: 0067 (moments feed), 0068 (moment comments).
- `comments_count_sync`, `comments_notify`, `delete_comment`, the comments policies, `fn:moderate` for comments (no change: it already works by comment id), push copy.
- New `src/features/moments/` (feed view, card, hook), `app/(tabs)/moments.tsx`, `CommentsView`/`useComments` (thread scope), `MomentDetailView` (comment button target).
- pgTAP: moment comments as owner, reader, outsider and blocked user for each visibility.

**Design:** new **MomentsFeed** screen (from Feed and Moment), **Comments** with a moment header, **Moment** (comment count is the moment's own).

**Risks:** Every visibility rule must hold for moments shown outside a jar (rule 9, FR-PUB-05, FR-PUB-06). The timeline query must stay fast: an index on `moments (user_id, added_at desc) where status = 'live'`. Run the load test script (D-38) against the new RPC.

**Size:** L (feed) + M–L (comments).

### 3. Tapping a moment on Today opens a preview

**Today:** Tapping a filled tile opens the **Moment options** bottom sheet straight away (Edit, Move, Private, Delete). Checking or removed moments open `/moment/[id]` (OwnMomentView).

**Change:**

- Tapping a filled tile opens a full-screen **preview** of your own moment: the 3:4 photo with edits, the slot, time, caption, visibility and like and comment counts.
- Swipe left and right through today's moments.
- An action bar holds Edit, Share, Visibility and a "More" button (Move, Set as cover, Delete).
- Queued moments that haven't uploaded yet preview from the local file, with only Edit and Delete.
- Checking and removed moments keep their current screens.
- The Moment options sheet stays as the "More" menu.

**Touches:** `/moment/[id]` (own-moment mode), `OwnMomentView` / `MomentDetailView` (shared photo and bars), `TodayView` (tile press), `MomentOptions` (opened from the preview), `momentActions`.

**Design:** new **MomentPreview** (based on Moment and MomentOptions).

**Size:** M. Needs piece 4 for the Visibility action, or ships first with the current Private toggle.

### 4. Tab bar: Today | Moments | Jars

**Today:**

- Four tabs: Today, Capture, Jars, My days (`app/(tabs)/_layout.tsx`, `FloatingTabBar`).
- Capture opens the camera.
- My days is also reachable from the calendar button on Today's header.

**Change:**

- Three tabs in the order he wrote them: **Today | Moments | Jars**. Today stands out: a filled green pill with a larger icon whether or not it is selected.
- Capture is hidden with `href: null`; the route and the camera stay, so it can come back.
- My days leaves the tab bar and becomes a normal stack screen at `/my-days`, opened from the calendar button. Memories already links back to it.
- D-17 ("keep 'My days' as the tab name") no longer applies: the screen keeps its name but isn't a tab.

**Touches:** `app/(tabs)/_layout.tsx`, `FloatingTabBar` (`mainTabs`), move `app/(tabs)/my-days.tsx` to `app/my-days.tsx`, `memories.tsx` links, the i18n tab labels, the large-text check for the bar (D-37).

**Design:** **Main** (tab bar).

**Size:** S. The Moments tab itself arrives with piece 5. Until then the bar is Today | Jars.

### 5. Camera: remove the hashtag picker

**Today:** The camera shows `SlotSwitcher`, a row of slot hashtags under the viewfinder for changing the slot.

**Change:**

- Remove the switcher. The camera always opens from a tile, so the slot is known. The slot tag at the top stays, read only.
- If the camera opens without a slot (only the hidden Capture tab could do that), it uses the Now slot, else the first empty slot.
- The gallery button and Fill this jar keep working.

**Touches:** `CameraView`, `app/camera.tsx`, `cameraSlot.ts`, camera tests.

**Design:** **Camera**.

**Size:** S.

### 6. Move "Published at 10:10 PM …" into the black jar card

**Today:** `PublishedNote` is a green banner above the jar card on Today after publishing (TodayPublished design, FR-PUB-04).

**Change:**

- Drop the banner and show one short line inside the black jar card: "Published 10:10 PM · Readers".
- Tapping that line opens the visibility sheet, which the card already does.
- With item 7, moments no longer depend on publishing, so the line "new moments go out automatically" is dropped.

**Touches:** `TodayView`, `JarCard`, `PublishedNote` (removed), i18n.

**Design:** **TodayPublished**.

**Size:** S.

### 7. Moments follow the default visibility unless changed

**Today:**

- Visibility belongs to the **jar** (`jars.visibility`: readers, everyone, only_me), chosen when publishing. A moment only has `is_private`.
- `can_view_moment` lets others see a moment only when its jar is published and visible to them (FR-PUB-02, "nobody sees anything before Publish jar").
- `profiles.default_visibility` (default `readers`) only pre-selects the Publish review choice.

**Change (product rule, decision D1–D3):**

- Each moment gets its own visibility: **Readers**, **Everyone** or **Only me** (private).
- A new moment starts at the owner's default visibility; the editor, the preview and Moment options can change it.
- A live moment can be seen by others **as soon as it is live**, whether or not its jar is published (moderation still decides `live`, rule 4).
- Publishing a jar only puts the jar in the Jars timeline (item 8). It doesn't change any moment's visibility.
- A published jar shows each viewer only the moments they may see themselves.

**Data model (migration 0066):**

- Add `moments.visibility jar_visibility not null default 'readers'`. The insert trigger fills it from `profiles.default_visibility` when the app doesn't send it.
- Keep `is_private` (no drop or rename) and keep it derived: a trigger sets `is_private = (visibility = 'only_me')`, and direct writes to `is_private` are refused. Every app writer moves to `visibility` in the same piece, so no client writes `is_private` any more. Dropping the column later needs the owner's approval.
- New `can_view_moment(viewer, m)`: the owner; or a live, not hidden moment of an active, unblocked owner whose visibility is `everyone`, or `readers` and the viewer reads the owner. The published-jar condition goes away.
- `visible_count` (D-9) keeps counting live moments that aren't Only me, which is what readers see. Others see per-viewer counts computed in the RPCs.
- Every query that filters `not m.is_private` for "what others see" must check the moment's own visibility instead:
  - 0014 `feed_page`, 0019 notifications, 0025 `public_jar`/`public_profile`, 0031 Explore and search, the jar page query, `fn:photo-urls` (uses `can_view_moment`, so it follows automatically), `fn:account-jobs` (the export is the owner's own; unchanged).
  - The shared web page (D-32) and Explore (D-18) may show only `everyone` moments.
- **Existing data (decision D2):** moments in published jars take their jar's visibility, private moments become Only me, and moments in unpublished jars become Only me. Nothing that was hidden yesterday becomes visible. This runs on local and on staging (D-47).

**Touches:**

- The migration, the policies and RPCs listed above, generated types.
- The editor's Private toggle becomes a three-way choice. Moment options gets Visibility instead of Private. Publish review shows each moment's visibility badge.
- `useToday`/`todayGrid` (badge on tiles), the share card (an Only me moment can't be shared).
- pgTAP for every visibility × jar published or not × owner, reader, outsider and blocked user, plus the web page and Explore tests.

**Design:** **Capture** (editor visibility choice), **MomentOptions**, **Publish**, **Main/Today** (tile badge).

**Risks:** The biggest piece for privacy. A missed `not is_private` call site would leak Readers moments to the web page or Explore. Every one is listed above and gets a test. FR-PUB-02, FR-PUB-04 and FR-PUB-05 are rewritten.

**Size:** L.

### 8. Jars appear in the Jars timeline only once published

**Today:** Already true. `feed_page` requires `published_at is not null`, and `can_view_jar` hides unpublished jars from everyone but the owner.

**Change:** None. With item 9 your own published jars also appear; your unpublished jar stays on Today only.

### 9. See my own moments and jars in both timelines

**Today:** `feed_page` leaves out your own jars (`j.user_id <> uid`). With nobody to read, Jars shows the empty state (FR-SOC-02).

**Change:**

- Both timelines include your own items. Your published jars appear in Jars; your live moments of any visibility, Only me included, appear in Moments, marked with a small lock when private.
- With nobody to read but something of your own, the timeline shows your items under a "Find people" card.
- "Jars, empty" shows only when there is nothing at all.
- The avatar row stays for authors you read.

**Touches:** `feed_page` (0066 or 0067), `moments_feed_page`, `FeedView`/`FeedEmpty`, the feed tests, pgTAP.

**Design:** **Feed** and **EmptyStories** (own items with a Find people card).

**Size:** S (jars) + included in item 2 (moments).

### 10. "Fill this jar" opens an empty day page, not the camera

**Today:** My days → a past day → Fill this jar opens `/camera?date=…&slot=…` straight away (FR-DAY-02, `useFillCapture`).

**Change:**

- Fill this jar opens a new **day page**, `/day/[date]`: the same 8-tile grid and jar card as Today, for that date, built from `useDayJar`.
- Tapping an empty tile opens the camera in the existing Fill mode (`?date=&slot=`). Gallery photos and the "Added later" badge (FR-JAR-06, server time) work as now.
- The page offers Publish for that day's jar if it isn't published yet (decision D8).

**Touches:** new `app/day/[date].tsx`, `TodayView` (accept a date instead of "today": no Now tile, no greeting), `my-days` (onFill), `/publish` (accept a jar id), i18n.

**Design:** new **Day** screen (from Main and EmptyToday), **Calendar** (Fill hint).

**Size:** M.

### 11. Choose a jar's cover photo

**Today:** The cover is derived (`jarPage.ts`): the moment with the newest caption, else the first in slot order. The feed card's mosaic uses slot order.

**Change:**

- The owner picks a cover with "Set as cover" in the moment preview (item 3) or Moment options.
- The cover is used on the jar page, the feed card (cover first in the mosaic), the share card, the web page and the widget.
- If the chosen moment is removed, deleted or made Only me, the jar falls back to the derived rule.

**Data model (migration 0069):**

- Add `jars.cover_moment_id uuid null references moments on delete set null`. A check trigger allows only a moment of the same jar, and only the owner can set it.
- Readers see it only if they can see that moment, else the derived cover.
- `feed_page`, the jar page query and `public_jar` return the resolved cover.

**Touches:** the migration and RPCs, `jarPage.ts`, `FeedMosaic`, `shareCard`, `apps/web` jar page, widgets, pgTAP.

**Design:** **Story** (jar page), **MomentOptions** ("Set as cover"), **Feed** card.

**Size:** M.

### 12. Story progress bars: one per moment, not eight

**Today:** Moment detail draws `slots.length` bars, always 8, while swiping goes through only the shown moments (`MomentDetailView.tsx`).

**Change:** One bar per moment shown, and the current one highlighted. A single moment shows no bars. FR-SOC-04 changes from "8 progress bars" to "one per shown moment".

**Touches:** `MomentDetailView` and its test.

**Design:** **Moment** and **Story**.

**Size:** S.

### 14. Editor: parallax when swiping up to the tools

**Today:** The editor is one `ScrollView`: the photo and the tool panel scroll up together, so the photo leaves the screen at full speed.

**Change:**

- Drive the scroll with Reanimated (`useAnimatedScrollHandler`). The photo moves up at about 40% of the scroll speed and scales down a little, while the panel slides over it.
- Most of the panel is revealed with the top of the photo still visible.
- Reduce Motion turns the parallax off (rule 11).
- Overlay gestures keep disabling the scroll as now.

**Touches:** `EditorView`.

**Design:** **Capture**, a note on the scroll behavior.

**Size:** M (with 16).

### 15. Stickers: show that the grid scrolls

**Today:** The sticker grid shows three rows (`VISIBLE_ROWS`) inside a `ScrollView` with a fixed `maxHeight`. Nothing shows that more rows exist (Olivia has more than 9).

**Change:**

- Cut the grid at about 2.5 rows so the next row is half visible, which is the usual iOS hint.
- Add a soft fade at the bottom edge while more rows remain.
- Flash the scroll indicator when a pack opens.
- Optionally show a count on each tab ("Olivia · 12").

**Touches:** `StickersPanel`.

**Design:** **Stickers**.

**Size:** S.

### 16. Editor: a top toolbar with Save

**Today:** The editor's top has only a floating Close button and the slot tag over the photo. During the fade-in the area above the photo is plain black. Save ("Add to #slot" / "Done") is a big button at the bottom of the panel.

**Change:**

- A fixed toolbar at the top: Close on the left, the slot tag in the middle, **Save** on the right. It has room for more actions later (Undo, for example).
- The bottom Save button is removed (decision D12).
- On iOS 26 the toolbar uses Liquid Glass (item 17); below iOS 26 it stays a dark blurred bar.

**Touches:** `EditorView`, `EditSession`/`MomentEditSession`/`QueuedEditSession` (save label and busy state), `app/edit/[momentId].tsx`, tests and the Maestro flows that tap `editor-save`.

**Design:** **Capture**, **Bubble**, **Text** (the editor's other tool screens).

**Size:** M (with 14).

### 17. Liquid Glass on compatible iOS versions

**What exists (free, already in the Expo SDK 58 the app uses):**

| Option                                                           | What it gives                                                                                          | iOS                                  | Notes                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`expo-glass-effect`** ~58.0.5 (MIT)                            | `GlassView`, `GlassContainer`, `isLiquidGlassAvailable()`, `isGlassEffectAPIAvailable()`               | 26+; renders a plain `View` below 26 | Listed in Expo's bundled modules and already installed as an `expo-router` dependency. Adding it directly costs no new native code. Has a `clear`/`regular` style, tint and interactive press. |
| **Expo Router native tabs** (`expo-router/unstable-native-tabs`) | The real `UITabBar`, which iOS 26 draws as Liquid Glass and minimizes on scroll                        | 26+ for glass                        | "Unstable" API; icons and labels only, so the floating bar's design and a bigger Today tab can't be kept.                                                                                      |
| **`@expo/ui` SwiftUI** ~58.0.28 (MIT, already a dependency)      | `GlassEffectContainer` and the `glassEffect` modifier, for groups of glass shapes that merge and morph | 26+                                  | Needs a SwiftUI `Host`; good for a few special controls, not whole screens.                                                                                                                    |
| `react-native-screens` 4.30 native headers and `formSheet`       | System headers and sheets get glass on iOS 26 automatically                                            | 26+                                  | Pickld draws its own headers and uses `@gorhom/bottom-sheet`, so this would mean changing those screens. Not proposed now.                                                                     |

Liquid Glass needs **iOS 26 or later**, and the app must be built with the iOS 26 SDK (Xcode 26), which the Mac already uses: the Simulator runtime is iOS 26.2. EAS builds need the Xcode 26 image.

**Proposal (decision D10):**

- Add `expo-glass-effect` and use `GlassView` where Pickld already imitates glass:
  - the floating tab bar (`FloatingTabBar`, today an `expo-blur` view);
  - round icon buttons with `variant="glass"` (`RoundIconButton`);
  - the editor toolbar (16);
  - the moment preview's action bar (3);
  - Moment detail's top buttons.
- One small `GlassSurface` component chooses `GlassView` when `isLiquidGlassAvailable() && isGlassEffectAPIAvailable()` and Reduce Transparency is off, and the current `BlurView` look otherwise.
- Keep the custom tab bar rather than native tabs, so the Today emphasis (item 4) stays.

**Touches:** `package.json` (one free Expo module), `FloatingTabBar`, `RoundIconButton`, a new `GlassSurface`, the editor and preview bars.

**Design:** **Main**, **Moment**, **Capture**: a note that iOS 26 draws these as glass.

**Risks:** Glass over bright photos needs a contrast check (WCAG AA for labels, rule 12). Check it on his iPhone's iOS version. The tests mock the module.

**Size:** M.

### 18. Animations for big moments

**Today:**

- `Confetti` and `CelebrationReveal` exist for the Full jar celebration (8th moment) and Sticker unlocked. Reduce Motion swaps confetti for a fade.
- Publishing just returns to Today.
- D-36 kept the Pickld Promise without confetti.

**Change:**

- **Publishing your day:** a short confetti burst and the jar lid closing on the jar card when Today comes back.
- **Filling a slot:** the tile pops in (spring scale) and the jar card's fill rises. The 8th moment keeps the Full jar celebration.
- **Liking:** the heart pops.
- **Navigation:** shared photo transitions from a tile to the preview where Reanimated supports them; otherwise a fade and scale.
- Light haptics on publish, fill and like through **`expo-haptics`** (free Expo SDK module, decision D11).
- Reduce Motion drops the motion and keeps a fade, as now. D-36's plain Promise stays.

**Touches:** `Confetti` (reused), `TodayView`/`JarCard`, `LikeButton`, `/publish` success path, `package.json` (expo-haptics).

**Design:** **TodayPublished** (publish moment), **Main** (tile fill).

**Size:** M.

### 19. Email sign-in sends a code instead of a magic link

**Today:**

- Sign up and Sign in call `sendEmailLink` (`apps/mobile/src/lib/auth.ts`): `signInWithOtp` with `emailRedirectTo: pickld://auth/callback`. Supabase emails a link.
- Tapping it goes through Supabase's `/auth/v1/verify`, which redirects to `pickld://auth/callback?code=…`. `AuthCallbackScreen` exchanges the code with the Proof Key for Code Exchange (PKCE) verifier saved when the email was requested, so the link works only on the phone that asked for it.
- Check your email (`CheckEmailScreen`, design **CheckEmail**) says "Tap it on this phone", with Open email app, a 60-second Resend and Use a different email.
- On his iPhone the link points at `127.0.0.1:55421`, the Mac's local Supabase, which the phone can't reach. That's why he signs in through the helper page on the Mac (below).
- Apple and Google sign-in also return through `pickld://auth/callback`. They are off locally (`[auth.external.apple] enabled = false`) but are P0 in FR-ACC-01.

**Change:**

- **App:**
  - `sendEmailLink` becomes `sendEmailCode`: the same `signInWithOtp` call (sign up may create the account, sign in may not), without `emailRedirectTo`.
  - Check your email gets a code field: one `TextInput` with `textContentType="oneTimeCode"` and `autoComplete="one-time-code"`, number pad, shown as six boxes. iOS 17 and later offer the code from Mail above the keyboard.
  - It submits by itself at the 6th digit with `verifyOtp({ email, token, type: 'email' })`. The session then reaches `useAuthStore`, and the route guard from item 13 opens About you or Today.
  - New errors: "That code isn't right" and "That code has expired. Send a new one." Resend, Open email app and Use a different email stay.
  - Copy: "We sent a 6-digit code to … Enter it below."
- **Supabase Auth settings:**
  - Local (`supabase/config.toml`, `[auth.email]`): `otp_length = 6` stays; `otp_expiry` goes from 3600 to **600** (10 minutes, decision D13). Supabase allows 6–10 digits.
  - Staging and production: `scripts/deploy/configure.sh` sets `mailer_otp_length = 6` and `mailer_otp_exp = 600` through the Management API, next to the redirect list it already sets.
  - Brute force: `token_verifications = 30` per 5 minutes per IP address stays, and each code dies after 10 minutes or once used.
- **Email templates:** a separate thread owns their wording. The plan only needs both the **Magic link** and **Confirm signup** templates to show the code with `{{ .Token }}`: a brand-new account can get Confirm signup when confirmations are on. Recommendation (D13): code only, no link.
- **`pickld://auth/callback` and D-33:**
  - The route and `AuthCallbackScreen` stay for Apple and Google, and the redirect allow list keeps `pickld://auth/callback`. Emails stop using it.
  - D-33's sentence "Sign-in emails still use `pickld://auth/callback` until the Supabase redirect allow list includes the https form" is replaced by "Sign-in emails carry a 6-digit code and no link; `/auth/callback` is used only by Apple and Google sign-in." The `pickld.me/auth/callback` universal link stays for the providers.
  - A link email sent before the switch keeps working until it expires.
- **Moderation console (`apps/mod`):**
  - Today `/sign-in` emails a link to `/auth/confirm`, which exchanges the code using the PKCE cookie.
  - The templates are shared, so the console must switch too. The sign-in page becomes two steps: email, then "Enter the 6-digit code". A server action calls `verifyOtp({ email, token, type: 'email' })`, which sets the session cookies.
  - `/auth/confirm` is removed. `access.test.mjs` and `decide.test.mjs` sign in with the code from `auth.admin.generateLink` (`properties.email_otp`) through the real form, instead of the `token_hash` link.
  - The answer stays the same whether or not the address has an account.
- **Dev sign-in:** `scripts/dev-sign-in.sh` reads `verify?token=` from the email in Mailpit, the local test inbox; that breaks once the email has no link. It switches to the code and prints `pickld://dev/sign-in?email=…&code=…`. `DevSignIn` calls `verifyOtp({ email, token, type: 'email' })`. The Maestro flows that use the script keep working.
- **The Mac's sign-in helper page:** `/signin` on port 55431, served by the `pickld-tailscale-bridge` service from the untracked `pickld-staging/.amp/in/tailscale-bridge.mjs`. Today it lists the newest Mailpit emails as "Sign in as …" links and opens them on the phone. It changes to list each address with its code in large digits and its age, so he reads it and types it on the phone. Picking up the change means restarting that service for a few seconds; I'll ask first.

**Touches:** `src/lib/auth.ts`, `CheckEmailScreen`/`CheckEmailView`, `SignUpScreen`/`SignInScreen` (function name), `DevSignIn`, i18n (`auth.checkEmail`, `auth.errors`), `supabase/config.toml`, `scripts/deploy/configure.sh`, `scripts/dev-sign-in.sh`, `apps/mod` sign-in page and `/auth/confirm`, their tests (`auth.test.ts`, the onboarding screen tests, the mod Playwright tests), the Maestro onboarding flow, the bridge script. No schema or RPC change.

**Design:** **CheckEmail** (code boxes, wrong and expired states); **SignUp** and **SignIn** copy ("We'll email you a code").

**Risks:**

- **Ordering with the template thread.** If the templates switch to code-only first, the console, the dev script and the helper page stop working until this piece lands. If this piece lands first, the app waits for a code the email doesn't show. They must ship together: this piece's PR carries the config, and the template change is applied right after it merges.
- The "Pickld Local" build on his phone needs a new build after the switch, because the old build only understands links.
- The code field must work at 200% text (D-37) and have a label for VoiceOver.

**Size:** M.

## Pieces, order and what runs in parallel

| #   | Piece                       | Items                                      | Schema | Size | Depends on                            |
| --- | --------------------------- | ------------------------------------------ | ------ | ---- | ------------------------------------- |
| 1   | Bug fixes                   | 1, 13                                      | —      | S–M  | —                                     |
| 2   | Navigation and quick polish | 4 (Today \| Jars), 5, 6, 12, 15            | —      | M    | —                                     |
| 3   | Editor toolbar and parallax | 14, 16                                     | —      | M    | —                                     |
| 4   | Moment visibility           | 7, 8 (confirm), 9 (jars)                   | 0066   | L    | decisions D1–D3                       |
| 5   | Moments timeline and tab    | 2 (timeline), 4 (Moments tab), 9 (moments) | 0067   | L    | 4                                     |
| 6   | Moment comments             | 2 (comments)                               | 0068   | M–L  | 4                                     |
| 7   | Moment preview              | 3                                          | —      | M    | 4 (for the Visibility action)         |
| 8   | Day page for past days      | 10                                         | —      | M    | 2                                     |
| 9   | Cover photo                 | 11                                         | 0069   | M    | 4, 7                                  |
| 10  | Liquid Glass                | 17                                         | —      | M    | 2, 3, 7                               |
| 11  | Animations                  | 18                                         | —      | M    | 2, 7                                  |
| 12  | Email code sign-in          | 19                                         | —      | M    | 1 (route guard), D13, template thread |

- **Pieces 1, 2 and 3 run in parallel now.** They touch different files and none needs a decision except D5 (tab bar) and D12 (Save in the toolbar).
- **Piece 12 runs alongside 2 and 3** once piece 1 has merged (both touch the onboarding navigation). It ships together with the template change from the other thread.
- **Piece 4 is the gate** for the rule changes. After it, **5, 6 and 7 run in parallel**, and **8** can run alongside.
- **9, 10 and 11 come last.** They build on the preview, the new bars and the jar card.
- Each piece is one PR (or two for the large ones: schema first, then the app). Each waits for a green `ci` and its pgTAP tests, and each new rule is recorded as a D-number in `docs/decisions.md`. After each piece the local stack and his phone build are refreshed so he can check it on the iPhone.
- New migrations number from **0066** (the last is 0065).

## Effect on existing decisions and requirements

- **FR-PUB-02** (nothing visible before Publish jar) becomes "no **jar** is visible before Publish jar; moments follow their own visibility". **FR-PUB-04** (auto-share after publishing) no longer applies to moments. **FR-PUB-05** (private never leaves the owner) holds, as Only me. **FR-PUB-01** shows moment badges.
- **FR-SOC-01/02** add the Moments timeline and own items. **FR-SOC-04** gets per-moment bars and the moment's own comments. **FR-SOC-06** comments get a moment thread.
- **FR-JAR-02** (tile tap opens the preview), **FR-DAY-02** (Fill opens the day page), **FR-CAP** camera (no slot switcher).
- **D-9:** `visible_count` stays "live and not Only me"; per-viewer counts come from the RPCs.
- **D-12:** photo tokens follow the new `can_view_moment` automatically.
- **D-17:** superseded. My days isn't a tab any more; the screen keeps its name.
- **D-18:** Explore shows Everyone jars with only their Everyone moments.
- **D-22 / D-41:** unchanged. Moments still become visible only after `fn:moderate` sets `live`, which now matters sooner because nothing waits for Publish.
- **D-29:** unchanged (no likes on comments).
- **D-32:** the shared web page shows only Everyone moments of an Everyone jar.
- **D-36 #4:** the Promise stays without confetti; confetti is added to publishing.
- **D-37:** the three-tab bar and the new toolbar follow the same large-text rules.
- **D-3, D-27:** unchanged. Moves stay within a jar; a removed slot can still be filled again.
- **FR-ACC-01/02:** "email link" becomes "email code": email sends a 6-digit code, Check your email takes it, and the 60-second resend stays.
- **D-33:** the sign-in email sentence is replaced (item 19); universal links and `/auth/callback` stay for Apple and Google.

## Open decisions

Each has a recommendation; "yes" accepts it.

1. **D1 Moment visibility:** each moment has its own visibility (Readers, Everyone, Only me), starts at the default visibility, and is visible once live without waiting for Publish jar. Publishing only adds the jar to the Jars timeline.
2. **D2 Existing moments:** published jars' moments take the jar's visibility, private ones become Only me, and unpublished jars' moments become Only me, so nothing hidden becomes visible.
3. **D3 Mixed jars:** a published jar shows each viewer only the moments they may see, and publishing never changes a moment's visibility. The web page and Explore show only Everyone moments.
4. **D4 Moment comments:** each moment has its own thread. Existing comments stay on the jar thread, Moment detail opens the moment's thread, and the jar's count covers only the jar thread.
5. **D5 Tab bar:** Today | Moments | Jars in that order, with Today as a filled green pill. My days is opened from the calendar button only. Capture is hidden, not deleted.
6. **D6 Own items:** both timelines include my own items, with a Find people card on top when I read nobody. Only me moments show in my Moments timeline with a lock.
7. **D7 Preview actions:** the preview's bar shows Edit, Share and Visibility, with Move, Set as cover and Delete under More. Swipe moves through today's moments.
8. **D8 Day page:** Fill this jar opens a day page that works like Today for that date and can publish that day's jar if it isn't published.
9. **D9 Cover:** the owner picks the cover; otherwise the current rule (newest caption, else first slot) applies. It is used on the jar page, feed card, share card, web page and widget.
10. **D10 Liquid Glass:** use `expo-glass-effect` on iOS 26+ for the tab bar, round buttons, editor toolbar and preview bar, with today's blur below iOS 26 or with Reduce Transparency on. Keep the custom tab bar instead of native tabs.
11. **D11 Animations:** add `expo-haptics` (free) for light taps on publish, fill and like. Confetti on publishing, a pop when a slot fills, and the Promise stays plain.
12. **D12 Editor Save:** Save moves to the new top toolbar and the bottom button goes away.
13. **D13 Email code:** sign-in emails carry only a 6-digit code (no link), valid for 10 minutes, for both the app and the moderation console. `pickld://auth/callback` stays only for Apple and Google.
