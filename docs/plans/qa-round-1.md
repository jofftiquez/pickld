# Plan — QA round 1 (iPhone test, Nov 13)

Nov 13, 2026. Planning only: nothing here is built yet. The product owner tested "Pickld Local" on his iPhone against the Mac's local Supabase and sent 18 items, then added item 19 (email sign-in with a code), items 20–22 (a Stickers page, the share card layout and success toasts) and items 23–26 (more filters, the crop page's Save button, a selfie mirror setting and a green shutter). Each item below says what happens today and why, the proposed change, what it touches, which design screens change, the risks and a rough size. The work is grouped into pieces that ship separately, in order, with the pieces that can run at the same time marked. Open decisions are at the end, each with a recommendation.

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
- **Items 20–22 are app-only, no schema:**
  - A Stickers page that joins the existing My stickers and Shop screens.
  - A share card where the picture is the main view and the layout follows the number of moments.
  - One shared toast for success messages.
- **Items 23–26 are capture polish, no schema:**
  - More color filters (23).
  - **Crop's Save button is off screen (24):** the photo frame is sized from the screen height without counting the header, so the sheet below it is too short for its own button.
  - A Mirror selfies setting (25).
  - A green shutter (26).

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

- Three tabs in the order he wrote them: **Today | Moments | Jars**. Only the selected tab is highlighted, the same way for every tab, as before. (A permanent green pill for Today was tried in piece 2 and dropped on Nov 13: keeping Today green meant outlining the whole button to show it was selected. D-52 is updated.)
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
- Keep the custom tab bar rather than native tabs, so the bar keeps its look and its large-text rules (D-37).

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

### 20. A dedicated Stickers page

**Today:**

- The sticker screens already exist: **My stickers** (`/stickers/mine`, owned and earned packs), the **Sticker shop** (`/stickers/shop`) and **Pack preview** (`/stickers/pack/[slug]`).
- The only ways in are Settings → My stickers and the Shop button in the editor's Stickers panel. Nothing on Today, the tabs or the profile leads there, which is why stickers seem to exist only in edit mode.

**Change:**

- One **Stickers** page at `/stickers` with a Mine | Shop switch at the top, built from the two existing views. Tapping a pack opens Pack preview as now.
- Entry point: a stickers button in Today's header next to the calendar (decision D14). It is not a tab, because item 4 keeps three tabs. Your own profile gets a "Stickers" row too.
- `/stickers/mine` and `/stickers/shop` redirect to `/stickers?tab=…`, so Settings, My stickers' Shop button and the editor's Shop button keep working.
- When user-made packs arrive (`docs/plans/user-sticker-packs.md`), they appear as a section of Shop.

**Touches:** new `app/stickers/index.tsx` and a small `StickersHome` that hosts `MyStickersView` and `StickerShopView`, `TodayView` header, own profile, `SettingsScreen`, i18n. No schema change; it uses the same `useMyStickers` and `useShop` queries.

**Design:** new **Stickers home** (from MyStickers and StickerShop), **Main** (header button).

**Size:** S–M.

### 21. Share jar: a bigger picture and layouts that follow the moment count

**Today:**

- The Share page (`ShareCardView`, design **ShareCard**) has a header, the card preview in the middle, and a white panel below with Format (Story 9:16 or Post 4:5), five backgrounds, Include captions, four actions (Save image, Copy link, Message, Share to…) and the Share to button.
- On his phone that panel takes about half the screen, so the preview is small.
- The card always lays the jar out as **2 rows of 4** (`StoryCard`, `card.moments.slice(0, 4)` and `slice(4, 8)`). A jar with 3 moments shows 3 small tiles and empty space. Private moments are already left out (FR-SOC-10).

**Change:**

- **Picture first,** like sharing a Spotify song to Instagram Stories: the card fills about two thirds of the screen, and the controls fit in a bottom panel of about one third. The panel holds:
  - a row of layout thumbnails;
  - a row of background swatches;
  - the four actions.
- Format (Story or Post) and Include captions move to an Options button in the header (decision D15). At 200% text the panel scrolls rather than shrinking the card (D-37).
- **Layouts by moment count** (the moments shown on the card). The first one listed is the default:

| Moments | Layouts                                                |
| ------- | ------------------------------------------------------ |
| 1       | Full: the photo fills the template                     |
| 2       | Side by side; stacked top and bottom                   |
| 3       | One large and two small; three stacked; three in a row |
| 4       | 2×2 grid; one large and three small                    |
| 5–6     | 2×3 grid; one large and a strip below                  |
| 7–8     | 2×4 grid (today's); 4×2 grid; film strip               |

- Sharing one moment keeps the single full layout.
- Layouts are data: `storyLayout.ts` gets `layoutsFor(count, format)`, which returns each photo's rectangle inside the safe area, and `StoryCard` draws the photos into those rectangles. The exported 1080-pixel image uses the same rectangles, so the preview and the shared file match.

**Touches:** `ShareCardView`, `StoryCard`, `storyLayout.ts` and its tests (every rectangle inside the safe area, no overlaps, a layout for every count 1–8 and both formats), `ShareCardScreen` (selected layout), i18n. No schema change.

**Design:** **ShareCard** (new proportions, the layout row, the Options menu), plus a thumbnail for each layout.

**Risks:** Photos are 3:4. Tall or wide cells crop them, centered, so a face near the edge can be cut off. The layout row has to stay readable at 200% text.

**Size:** M–L.

### 22. Success toasts

**Today:** The app has no toast. Success is shown inline when it is shown at all, such as "Sent again" on Check your email or a notice on the Share page. Many actions give no confirmation; errors use inline messages and alerts.

**Change:**

- One shared **Toast**: a short pill near the top, under the status bar, with an icon and one line of text. It disappears after about 2.5 seconds and can be swiped away. It leaves room for an Undo button later.
- Built in the repo with Reanimated and a small Zustand store (`showToast('momentSaved')`), styled from `tokens.ts`. No new library (decision D16). On iOS 26 it uses the glass surface from item 17.
- VoiceOver reads it aloud (`AccessibilityInfo.announceForAccessibility`). With Reduce Motion it fades instead of sliding. The text comes from `en.json`. It never shows a photo or caption.
- Errors keep today's inline messages and alerts.
- Actions that get a toast:
  - Moment added to #slot, or saved to upload later when offline;
  - Changes saved, Moment moved, Moment deleted, Visibility changed, Cover set;
  - Jar published;
  - Link copied, Image saved to Photos;
  - Profile updated, Photo updated;
  - Following someone, Unfollowed, Blocked, Unblocked, Report sent;
  - Pack added.
- Pieces built after this one add toasts for their own actions.

**Touches:** new `src/components/Toast.tsx` and a host in `app/_layout.tsx`, `src/lib/toast.ts`, and the call sites: `momentActions`, the edit sessions, `/publish`, `shareActions`, the profile settings, the follow, block and report actions, the sticker shop. Tests, i18n `toast.*`.

**Design:** a new **Toast** component in the component kit, shown on **Main** and **ShareCard**.

**Size:** M.

### 23. More filters

**Today:** Five color filters: Original, Kalamansi, Merienda, Mono and Dusk (FR-CAP-04). Each is a 4×5 Skia color matrix in `filters.ts`; the list of ids is `filters` in `tokens.ts`. The editor shows them in a horizontal row that already scrolls, but all five fit on screen. A moment stores only the filter id in `moments.edits` (FR-CAP-08), so there is no database constraint on the names.

**Change (decision D17):**

- Add six color-only looks (rule 8: no beauty or face filters), named in the same spirit as Kalamansi and Merienda. Each is built from saturation, tint, lift and contrast, which a color matrix can do:
  - **Kape**: warm, faded brown.
  - **Ube**: soft lavender pastel.
  - **Sampaguita**: bright and clean, slightly cool.
  - **Gabi**: cool night look with more contrast.
  - **Luma**: vintage, faded and a little sepia.
  - **Ulan**: rainy, muted blue-green.
- Original stays first and the old five keep their order, so nothing moves under the thumb.
- With 11 thumbnails the row scrolls. Size it so the last visible thumbnail is cut in half, the same hint as the sticker grid (item 15).
- **Where the list lives:**
  - The app: `tokens.ts`, `filters.ts` and `en.json` (`edit.filter.*`).
  - The web page reuses the app's `filterMatrices` through its `@/` path, so it follows automatically.
  - The data export draws finished photos from copies of the matrices in `supabase/functions/_shared/moment_layout.ts`, with an id list in `moment_render.ts`. Both get the new entries, and `exportRenderSpec.test.ts` already fails if the copies differ.
- **Older builds** parse the filter with a fallback to Original (`edits.ts`, `moment_render.ts`), so a moment with a new filter shows unfiltered there instead of failing. Only test builds exist, so that is acceptable.

**Touches:** `tokens.ts`, `filters.ts`, `en.json`, `EditorView` (row sizing), `moment_layout.ts`, `moment_render.ts`, and the `filters` and `exportRenderSpec` tests. No migration.

**Design:** **Capture** (the filter row).

**Risks:** Each matrix must keep black and white from clipping. `filters.test.ts` checks the existing ones that way; extend it to the new ones. Judge the looks on real photos on his iPhone before merging.

**Size:** S–M.

### 24. Crop: "Save crop" is hard to reach

**Today:** Crop (`CropView`) stacks the header, the photo area and a white sheet. The sheet is a `ScrollView` holding the zoom slider, Rotate/Flip/Fit, a note, and at the bottom the main button ("Next: edit" from the gallery, "Save crop" for Re-crop).

**Why it's hidden:** `cropFrame` limits the frame's height to 400/844 of the **window** height, and the photo area adds 60 pt above and below the frame. The header and the top safe area aren't counted.

- On an iPhone 17 Pro (874 pt tall), the header uses about 150 pt and the photo area about 534 pt, which leaves the sheet about 190 pt.
- The sheet's contents need about 310 pt, so the button starts below the screen and you have to scroll a short sheet to find it.
- These numbers are worked out from the code. Confirm them with a capture on his iPhone when building.

**Change (decision D18):**

- Move the main button into the header's right side as a green pill, like the editor's Save (D-59): **Cancel | Crop · #slot | Next: edit / Save crop**.
- Reset leaves the header and joins Rotate, Flip and Fit as a fourth tool.
- Size the frame from the space actually left after the header and the sheet, so the sheet always fits without scrolling. The sheet keeps scrolling only at large text sizes (D-37).
- The button is disabled while saving, as now, and the error line stays above the tools.

**Touches:** `CropView`, `CropHeaderAction` (or the editor's `PillButton`), `cropMath.ts` (`cropFrame`), `tokens.ts` (`crop`), the `CropScreen` tests and the Maestro flows that scroll to and tap `crop-done`.

**Design:** **Crop**.

**Risks:** Reset next to the tools must not be mistaken for an action that saves. Keep its "Reset" label and accessibility hint.

**Size:** S–M.

### 25. A setting to mirror selfies or not

**Today:** The camera uses VisionCamera's default `mirrorMode: 'auto'`. That mirrors front-camera **outputs**, the saved photo as well as the preview, so a selfie is saved the way you saw it in the viewfinder, mirrored. There is no setting.

- This is from the library's code and docs. The Simulator has no camera, so confirm it on his iPhone.

**Change (decision D19):**

- A new **Camera** section in Settings with one switch, **Mirror selfies**. It is on by default, which keeps today's behavior and matches the iPhone Camera app's default.
- Keep the preview mirrored either way, as the iPhone Camera does. When the switch is off, flip front-camera photos left to right in the existing image pipeline (`pipeline.ts` already supports `flip`) before they are queued. This is simpler and safer than a separate camera mirror setting per output.
- The setting is saved on this phone only, in the local key-value store the app already uses (`expo-sqlite/kv-store`), and not sent to the server. It affects new photos only. Gallery imports and photos already taken don't change.
- Crop's Flip still lets you mirror any single photo.

**Touches:** `SettingsView` and `useSettings` (new section and switch), a small `cameraPrefs` module, `app/camera.tsx` (pass the facing and the setting to the pipeline), `pipeline.ts` or `saveCapture`, `en.json`, tests for the setting and for the flip of front-camera photos.

**Design:** **Settings** (new Camera section).

**Risks:** The flip must happen before the photo is queued, so the queued file, the upload and the edits all agree, and an offline capture keeps the setting it was taken with.

**Size:** S.

### 26. The shutter button in primary green

**Today:** `ShutterButton` is a white ring around a white disc.

**Change:** The disc becomes brand green (`colors.brand`, #7fad33), inside the same white ring. Pressed and disabled keep their opacity changes. There's no text on it, so rule 12's white-text rule isn't affected, and the green disc stands out against the black camera background.

**Touches:** `ShutterButton`, its test, `tokens.ts` if a named color is added.

**Design:** **Camera**.

**Size:** S.

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
| 13  | Success toasts              | 22                                         | —      | M    | —                                     |
| 14  | Stickers page               | 20                                         | —      | S–M  | 2 (Today header)                      |
| 15  | Share card layouts          | 21                                         | —      | M–L  | —                                     |
| 16  | Capture polish              | 23, 24, 25, 26                             | —      | M    | 3 (editor panel), D17–D19             |

- **Pieces 1, 2 and 3 run in parallel now.** They touch different files and none needs a decision except D5 (tab bar) and D12 (Save in the toolbar).
- **Piece 12 runs alongside 2 and 3** once piece 1 has merged (both touch the onboarding navigation). It ships together with the template change from the other thread.
- **Piece 13 (toasts) runs early, in parallel with 1–3,** so the later pieces can call it. **Pieces 14 and 15 are independent** and can run alongside anything; 14 waits for piece 2's header change.
- **Piece 16 (capture polish) runs alongside anything** once piece 3 has merged, since the filter row sits in the editor panel that piece 3 changed. The crop, mirror and shutter parts don't need piece 3 and can be split off if a decision holds up the filters.
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
- **D-52:** updated Nov 13. Only the selected tab is highlighted; Today has no permanent green pill.
- **D-18:** Explore shows Everyone jars with only their Everyone moments.
- **D-22 / D-41:** unchanged. Moments still become visible only after `fn:moderate` sets `live`, which now matters sooner because nothing waits for Publish.
- **D-29:** unchanged (no likes on comments).
- **D-32:** the shared web page shows only Everyone moments of an Everyone jar.
- **D-36 #4:** the Promise stays without confetti; confetti is added to publishing.
- **D-37:** the three-tab bar and the new toolbar follow the same large-text rules.
- **D-3, D-27:** unchanged. Moves stay within a jar; a removed slot can still be filled again.
- **FR-ACC-01/02:** "email link" becomes "email code": email sends a 6-digit code, Check your email takes it, and the 60-second resend stays.
- **D-33:** the sign-in email sentence is replaced (item 19); universal links and `/auth/callback` stay for Apple and Google.
- **FR-SOC-10:** "8 moments" becomes "the shown moments in a layout the user picks"; private moments are still never included.
- **FR-STK-06:** the Sticker shop is reached from the new Stickers page as well as the editor.
- **FR-CAP-04:** the filter list grows from five to eleven (item 23). **FR-CAP-03:** the crop's main button moves to the header and Reset joins the tools (item 24). **FR-CAP-01:** the shutter is green, and front-camera photos follow the Mirror selfies setting (items 25 and 26).
- **D-59:** item 24 reuses the editor's toolbar pattern on Crop.

## Open decisions

Each has a recommendation; "yes" accepts it. **Accepted Nov 13:** the product owner accepted all 16 as recommended; they are recorded as D-48 to D-63 in `docs/decisions.md` (D1 is D-48, D16 is D-63).

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
14. **D14 Stickers page:** one Stickers page with Mine | Shop, opened from a stickers button in Today's header and a row on your profile, not a tab.
15. **D15 Share card:** the picture takes about two thirds of the screen, layout thumbnails and backgrounds sit in the bottom third, and Format and Include captions move to an Options button. The layouts are those in the item 21 table, with the first as the default.
16. **D16 Toasts:** one in-house toast near the top for success messages only, with no new library. Errors stay as they are.

Added Nov 13 with items 23–26 (asked one at a time; item 26 needs no decision). **Auto-approved Nov 13:** the product owner auto-approved D17–D19 as recommended; they are recorded as D-64 to D-66 in `docs/decisions.md`.

17. **D17 Filters:** add six color-only filters (Kape, Ube, Sampaguita, Gabi, Luma, Ulan), for eleven in all. Original stays first and the old five keep their order.
18. **D18 Crop button:** "Next: edit" / "Save crop" moves to the top right of the Crop header as a green pill, like the editor's Save. Reset joins the tools row, and the frame is sized so the sheet fits without scrolling.
19. **D19 Mirror selfies:** a Mirror selfies switch in a new Camera section of Settings, on by default (as today and like the iPhone Camera), saved on this phone only. When it's off, new front-camera photos are flipped back; the preview stays mirrored.

---

# Round 2 (iPhone test of the round 1 build, Nov 14)

The product owner tested the round 1 build (main at `b6664bc`) on his iPhone 14 Pro (iOS 27.0) and sent ten more items. He auto-approved my recommendations again, so every decision below is recorded in `docs/decisions.md` as auto-approved (D-79 onward). The next migration number is 0070; none of the pieces below needs one.

## Why items 1 and 2 didn't show up on the phone

**The installed build is right.** Pickld Local (`me.pickld.app.local`) on the phone was built and installed from `b6664bc`, and its bundle carries the round 1 code.

**Item 1 (profile photo, and now the cover photo): the local storage server rejects every upload, so the round 1 app fix never got a chance.** Verified on the phone and against the server:

- The phone's upload queue (`queue.db`, copied off the phone) holds 7 moments, all in state `failed` with `photo upload answered 500`. The photos are safe on the phone (rule 3), so they can retry once storage works.
- Reproduced with a real session through the Tailscale address: `fn:upload-url` answers 200, then the signed PUT to `/storage/v1/s3/photos/...` answers HTTP 500 `DatabaseError 42P10`.
- The cause is a version mismatch in the shared local Supabase. Its `storage` schema was migrated to storage-api **v1.90.1** (storage migrations 62–80, object versioning and lifecycle, ran at 03:18 on Nov 13). At 19:16 the storage container was re-created on the older **v1.72.1** image, which still upserts with `ON CONFLICT (bucket_id, name)`. Migration 72 (`drop-bucketid-objname-index`) removed the unique index that clause needs, so Postgres answers 42P10.
- The newest object in `storage.objects` is from 17:05, and no failed upload wrote a row. Every upload, moments included, has failed since about 19:16. The Simulator's "Didn't upload" tiles in the round 1 report were this, not a network problem as I said then.
- Change cover goes through the same `fn:upload-url` and PUT, so it fails the same way. The app code is fine.
- **Fix:** re-create the `supabase_storage_pickld` container on the v1.90.1 image that matches its schema. This restarts part of the shared local Supabase, so it waits for the product owner's OK. No data is lost: storage files and the database stay as they are. The other project's storage container (`supabase_storage_pwedepa`) is left alone.

**Item 2 (Liquid Glass): the phone qualifies, so the likely cause is that the glass is tinted almost opaque and looks like the old blur.** The phone is on iOS 27.0. The build used Xcode 26.4.1 (iOS 26.4 SDK), the only Xcode on the Mac. With that SDK, `expo-glass-effect` 58.0.5 turns glass on for iOS 26+ unless `UIDesignRequiresCompatibility` is set, and the built app's Info.plist doesn't set it. What's left is the `UIGlassEffect` check and Reduce Transparency, which a diagnostic build reads on the phone (results are in the item 2 section below). Meanwhile, the tints we put on the glass are heavy: `tabBarGlass` is 86% white and the dark glass is 45–60% black. On top of Liquid Glass, that reads as a solid bar, close to the old blur, which matches "I don't see it".

## Item by item

### R2-1 Profile photo upload, square cropper, cover upload, buttons overlapping the cover

- **Today:** uploads fail for the storage reason above. Change photo and Change cover take the gallery photo and crop its centre with no say for the person (`prepareProfileImage`, 512×512 avatar, 1500×600 cover). On the profile, the Edit profile and Share buttons sit below the cover band instead of straddling its bottom edge.
- **Change:**
  - Environment: re-create the storage container on v1.90.1, once approved.
  - Change photo opens the existing Crop screen in a square mode (pan and zoom, a circle guide over a square frame, no rotate or filters) before upload. Change cover opens it at the cover's 5:2 shape. Done uploads the crop; Cancel uploads nothing.
  - The Edit profile and Share buttons move up so their vertical middle sits on the cover's bottom edge, and the name and bio below don't move.
- **Touches:** `app/crop.tsx` (a `mode=avatar|cover` param), `src/features/profile/uploadProfileImage.ts`, `src/lib/image/profileImage.ts` (crop rect instead of centre crop), `app/settings/profile.tsx`, `src/features/profile/ProfileView.tsx`. No schema or RPC change.
- **Design:** Crop (square mode), Profile and ProfileOther (button position).
- **Risk:** Crop is shared with the camera's 3:4 flow, so the 3:4 path must stay unchanged (its tests must pass untouched). **Size:** M.

### R2-2 Liquid Glass on compatible devices

- **Today:** see above. The glass is likely on but tinted to look like the blur.
- **Change:** confirm the flags on the phone with a throwaway diagnostic build. If they are true, lighten the glass so it reads as glass: the tab bar uses the clear style with a light tint (for example 25–35% white) and the dark controls a lighter tint (about 20–30% black). Labels stay above WCAG AA (Web Content Accessibility Guidelines) 4.5:1 over bright and dark photos, using the label colors and a soft text shadow where needed rather than a heavy tint. Fall back to today's blur exactly as now. If a flag is false, fix the check instead (for example a build setting), and record why.
- **Touches:** `src/theme/tokens.ts` (`tabBarGlass`, `glass`, `glassStrong` tints for the glass path only), `src/components/GlassSurface.tsx`, `FloatingTabBar.tsx`, maybe `RoundIconButton.tsx`. No schema change.
- **Design:** Main, Moment, Capture notes (tints).
- **Risk:** contrast over bright photos, checked with Simulator captures over a white and a black photo. Building with the iOS 27 SDK would need Xcode 27, a large download, and isn't needed for glass. **Size:** S.

### R2-3 Sticker previews: fill the box

- **Today:** the shop's pack card shows three sample stickers spread across a wide box, leaving empty space between them.
- **Change:** the pack card shows a tighter cluster of five or six stickers (as many as the pack has, up to six) that fill the box, slightly overlapped and rotated, in the same style. Design only, no data change.
- **Touches:** `src/features/stickers/PackArt.tsx` (layouts per count), `useShop.ts` / `shop.ts` if the sample count comes from there. **Design:** StickerShop, Stickers. **Risk:** low; check small packs (fewer than six stickers). **Size:** S.

### R2-4 Story share: use the space; Strava-style link later

- **Today:** the round 1 layouts sit inside wide safe margins, so on a 9:16 story the photos leave a lot of plain background.
- **Change:** the photos take as much of the 1080×1920 card as possible. Cells fill the width with thin gutters and small outer margins, the grid grows into the top and bottom space, and names and captions move to compact overlays that stay out of the top 13% and bottom 18% Instagram covers. The post format (1080×1350) gets the same treatment. The Strava-style tappable link back to Pickld is **future task T-512** in `docs/tasks.md` (needs a Meta App ID, T-510); not built now.
- **Touches:** `src/features/share/storyLayout.ts`, `StoryCard.tsx`, `LayoutThumbnail.tsx`, their tests. **Design:** ShareCard. **Risk:** captions over photos must stay readable, and a single moment still shows whole at 3:4. **Size:** M.

### R2-5 Only share your own moments and jars

- **Today:** Share appears on other people's moments (Moment detail) and jars (Jar page), and `/share/[jarId]` makes a card for any jar the viewer can open.
- **Change:** Share shows only on my own moments and jars. `/share/[jarId]` checks the jar is mine and otherwise shows a "You can only share your own jars" state. The profile's Share (a link to the profile) stays. Sharing is made on the phone, with no server record, so there is no server rule to add; the public web page of an Everyone jar is a public link anyway.
- **Touches:** `MomentDetailView.tsx`, `app/moment/[id].tsx`, `JarPageView.tsx`, `app/jar/[id].tsx`, `app/share/[jarId].tsx`, `ShareCardScreen.tsx`, `en.json`. **Design:** Moment, JarPage (no Share for others). **Risk:** low. **Size:** S.

### R2-6 Comments show the moment fully

- **Today:** opening a moment's comments shows the thread with only a small part of the moment.
- **Change:** a moment's comment thread starts with the whole moment at 3:4 (filter and stickers drawn, as on Moment detail) and its caption, and scrolls with the comments; the composer stays pinned above the keyboard. A jar's thread is unchanged.
- **Touches:** `app/comments/[jarId].tsx` and its view, reusing the moment rendering from Moment detail. **Design:** Comments. **Risk:** keyboard and scroll on small phones. **Size:** S–M.

### R2-7 Under 13: Go back returns to onboarding

- **Today:** after a birthday under 13, the account is deleted and the phone signed out (FR-ACC-04), and Go back resets to the Welcome page.
- **Change:** Go back resets to the first intro (onboarding) page, `/intro/1`, with no history back into setup. The deletion stays: FR-ACC-04 requires it, and it keeps a child from going back to change the birthday.
- **Touches:** `app/setup/under13.tsx`. **Design:** Under13 (no visual change). **Size:** XS.

### R2-8 "Be a reader"

- **Today:** the follow button says "Read" (then "Reading", or "Read back" when they read you).
- **Change:** "Read" becomes **"Be a reader"** wherever it is the follow action; "Reading" and "Read back" stay. The accessibility label becomes "Be {{name}}'s reader". Check the button at 200% text and in rows (Find friends, readers lists); allow two lines rather than truncating.
- **Touches:** `en.json`, `FollowButton.tsx` (width), its tests. **Design:** Profile, ProfileOther, FindFriends. **Size:** XS.

### R2-9 Empty pages with placeholders and hints

- **Today:** some lists show one line when empty (Moments and Jars timelines, notifications, readers lists, the profile's grids), with no hint that pulling refreshes.
- **Change:** each empty list shows a small illustration (the jar graphic or an icon), a title, one helpful line, and an action where one exists (Find people, Add a moment). The pull-to-refresh lists add "Pull down to refresh" under the empty text. Copy lives in `en.json`.
- **Touches:** `app/(tabs)/moments.tsx`, `app/(tabs)/jars.tsx` and their views, notifications, readers, profile grids, a shared `EmptyState` component if one doesn't already exist. **Design:** Moments, Jars, Notifications (empty). **Size:** S–M.

### R2-10 Sticker pack page: no photo in the cover

- **Today:** the pack page's top section shows a photo with stickers on it.
- **Change:** the cover section shows only the pack's stickers, larger, on the pack's color, with no photo.
- **Touches:** `PackPreviewView.tsx`, `PackArt.tsx` (a large variant). **Design:** StickerPack. **Size:** S.

## Pieces, order and parallel work

| Piece            | Items   | Main files                                                   | Runs with                                              |
| ---------------- | ------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| P-A Profile      | 1       | crop, profile upload, ProfileView                            | C, D, F                                                |
| P-B Liquid Glass | 2       | tokens, GlassSurface, tab bar                                | after the diagnostic; with anything except files above |
| P-C Stickers     | 3, 10   | PackArt, PackPreviewView, shop                               | A, D, F                                                |
| P-D Share        | 4, 5    | storyLayout, StoryCard, share route, Moment detail, Jar page | A, C                                                   |
| P-E Comments     | 6       | comments route                                               | after D (Moment detail overlap is small)               |
| P-F Small fixes  | 7, 8, 9 | under13, FollowButton, empty states, en.json                 | A, C                                                   |

Order: A, C and D first in parallel; F and E next; B once the phone diagnostic is in. Each piece merges on a green `ci`. The phone gets a rebuild after the first batch and once more at the end. The storage fix happens whenever the product owner approves it; until then uploads (and the new cropper's upload) can't be checked end to end on the phone.

## Decisions (auto-approved Nov 14, recorded as D-79 onward)

1. **Profile crop (D-79):** Change photo opens Crop in a square mode with a circle guide, Change cover in a 5:2 mode; the Edit profile and Share buttons straddle the cover's bottom edge at their middle.
2. **Liquid Glass tints (D-80):** keep `expo-glass-effect`; on the glass path use lighter tints (clear style for the tab bar) so it reads as glass, keeping AA contrast; the blur fallback is unchanged. No Xcode 27 needed.
3. **Sticker previews (D-81):** pack cards show up to six stickers in a tight, slightly overlapped cluster; the pack page cover shows large stickers on the pack color, no photo.
4. **Story space (D-82):** photos fill the card with thin gutters and small margins; names and captions become compact overlays outside the covered top 13% and bottom 18%. The Strava-style link is future task T-512.
5. **Share own only (D-83):** Share appears only on my own moments and jars, and the share route refuses others' jars; profile sharing stays.
6. **Comments (D-84):** a moment's thread opens with the whole moment at 3:4 and its caption, scrolling with the comments.
7. **Under 13 (D-85):** Go back goes to the first intro page; the account deletion (FR-ACC-04) stays.
8. **Follow label (D-86):** "Read" becomes "Be a reader"; "Reading" and "Read back" stay.
9. **Empty states (D-87):** every empty list gets an illustration, title, hint and action where possible; pull-to-refresh lists say "Pull down to refresh".

**Parked, needs the product owner:** re-creating the local `supabase_storage_pickld` container on storage-api v1.90.1 to fix uploads (item 1).

# Round 3 (iPhone test of the round 2 build, Nov 14)

The product owner tested Pickld Local built from `62fc3d5` and sent seven items. He auto-approved my recommendations again, so each decision is recorded in `docs/decisions.md` as auto-approved (D-90 onward). No piece needs a migration or a schema change.

## Item by item

### R3-1 Moments timeline: tapping a moment opens its thread; "Go to jar" in the card header

- **Today:** the top of a Moments timeline card opens Moment detail (`/moment/[id]`); the comment pill opens the moment's thread (`/comments/[jarId]?momentId=…`). There is no direct way to the jar.
- **Change:** tapping the photo, header or caption opens the same thread the comment pill opens (it already shows the whole moment, D-84). The card header gets a "Go to jar" text button at its top right, opening `/jar/[id]`.
- **Touches:** `src/features/moments/MomentFeedCard.tsx`, `MomentsFeedView.tsx`, `app/(tabs)/moments.tsx`, `en.json`. **Design:** MomentsFeed. **Risk:** low; Moment detail stays reachable from the jar. **Size:** S.

### R3-2 Comment thread photo: rounded corners and a margin

- **Today:** D-84 draws the moment edge to edge with square corners, unlike every other photo in the app.
- **Change:** the photo sits inside the screen's side margin (`space.lg`), keeps the app's photo corner radius, and stays 3:4.
- **Touches:** `src/features/comments/CommentsView.tsx`. **Design:** Comments. **Size:** XS.

### R3-3 Jar previews leave out stickers and edits

- **Root cause:** the Jars timeline card (`FeedMosaic`) draws plain thumbnails. `feed_page` returns only `preview_moment_ids`, and `fn:photo-urls` returns only signed thumbnail URLs, so the card never gets a moment's edits. The same plain `Image` is used for previews on the profile grid, the My days day card, Explore's full jars and Memories. The Jar page grid and Today already use `MomentCover` with edits.
- **Change:** every moment preview draws the moment with its edits (filter, stickers, text, stamps) through `MomentCover`. The previews read `edits` and `captured_at` for the shown moment ids from `moments` (same RLS as the photos; a moment the viewer can't read keeps its plain thumbnail). Tiny calendar dots stay plain.
- **Touches:** `FeedMosaic.tsx`, `useFeed.ts`, `ProfileGridTile.tsx` / `useProfile.ts`, `SelectedDayCard.tsx`, `ExploreView.tsx` / `useExplore.ts`, `MemoriesView.tsx`. **Design:** Feed, Profile, MyDays (comments). **Risk:** a few more small reads per page; batched by id. **Size:** M.

### R3-4a Share screen redesign

- **Today:** D-89 keeps every photo 3:4, but some layouts leave large empty bands, pills hang beside narrow blocks (film strip), and the product owner calls the results "not sharable".
- **Change:** a redesign pass judged on the real exported images. Render every layout × background × moment count (1–8) × format (Story, post) plus single moments, save the full-size exports, judge each as an Instagram/Facebook Story or post (balance, empty space, readable text, safe zones, photos 3:4 and whole), fix what looks bad and cut layouts that can't look good. A contact sheet of the final exports goes to the product owner.
- **Touches:** `src/features/share/*`, a dev-only render screen for the exports, `design/screens/ShareCard.html`. **Risk:** a cut layout someone liked; each cut is recorded. **Size:** L.

### R3-4b Someone's day: no cover header, a 2 by 4 grid like Today

- **Today:** the Jar page (`JarPageView`) opens with a tall cover photo band (`sizes.jarCover`) with the author over it, then a highlight line and the grid.
- **Change:** a plain header (back, author avatar and name, day title, full tag, like, comments, share for the owner) over the moments in the same 2 by 4 grid as Today, in slot order, with the cover marked by a small badge. The cover still leads the Jars timeline card and the share card.
- **Touches:** `JarPageView.tsx`, `JarTile.tsx`, `jarPage.ts`, tokens. **Design:** Story (the Jar page). **Risk:** the highlight caption line goes; captions stay on Moment detail. **Size:** M.

### R3-5 New profile photo doesn't show elsewhere

- **Root cause:** avatar photos were only ever built for the Profile, Explore, Notifications, Find friends and Settings. `fetchMe` (Today header and the Me query) still says `TODO(M3-13)` and returns `avatarUrl: null`. The Moments timeline card, Jars timeline card, comments (rows, the moment's author and the composer), Moment detail, the Jar page, Readers and authors lists and Blocked all pass no photo to `Avatar`, so they show initials whatever is uploaded. Where avatars are signed, the cache keys don't change on upload, so the profile save also has to refresh Explore and the follow lists.
- **Change:** one hook signs avatars for a set of user ids through `fn:photo-urls` (batched, cached by the avatar path so a new upload is a new key), and every place above uses it. `fetchMe` signs the owner's avatar. The profile save refreshes every query holding avatars. The cover only appears on the profile, which already refreshes.
- **Touches:** a new `src/lib/avatars.ts` (or similar), `useToday.ts`, the views listed, `app/settings/profile.tsx`. The widgets show no avatar. **Design:** none (initials stay the fallback). **Risk:** extra signing calls; batched per screen. **Size:** M.

### R3-6 "Set as cover" is hard to find

- **Today:** Set as cover (D-56) lives in the moment preview's More sheet; nothing on the grid shows which moment is the cover.
- **Change:** the owner's moment preview (Today, a past day, the Jar page) shows a "Set as cover" action in its action row, and "Cover" when it already is. The Today and day grids and the Jar page mark the cover tile with a small "Cover" badge. More keeps the row too.
- **Touches:** `momentPreview.ts` (`previewActions`), `MomentPreviewView.tsx`, `app/moment/preview.tsx`, `MomentTile.tsx` / `todayGrid.ts`, `JarTile.tsx`, `en.json`. **Design:** MomentPreview, Main. **Size:** S.

### R3-7 #selfie opens on the front camera

- **Today:** the camera always starts on the back lens (`useState<CameraFacing>('back')` in `app/camera.tsx`).
- **Change:** the camera starts on the front lens when the slot is #selfie; flip still works. **Touches:** `app/camera.tsx`. **Size:** XS.

## Pieces, order and parallel work

| Piece                                  | Items       | Decisions | Main files                                                                                             | Runs with                                   |
| -------------------------------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| R3-H Share redesign                    | 4a          | D-90–D-92 | `src/features/share/*`, dev render screen                                                              | I, J                                        |
| R3-I Avatars, timeline, comments       | 5, 1, 2     | D-93–D-95 | avatars hook, MomentFeedCard, CommentsView, CommentItem, FeedJarCard, follow lists, `useToday`         | H, J                                        |
| R3-J Previews, day grid, cover, selfie | 3, 4b, 6, 7 | D-96–D-99 | FeedMosaic, ProfileGridTile, SelectedDayCard, Explore, Memories, JarPageView, JarTile, preview, camera | H, I (rebases on I for the Jar page avatar) |

All three run in parallel in their own worktrees. Each merges on a green `ci`. The phone gets a rebuild at the end.

## Decisions (auto-approved Nov 14, recorded as D-90 onward)

1. **Share redesign (D-90–D-92):** judged on full-size exports; layouts that can't look good are cut; photos stay 3:4 and whole.
2. **Avatars everywhere (D-93):** every person shown in the app uses their photo when they have one, initials otherwise.
3. **Timeline tap (D-94):** tapping a Moments timeline card opens the moment's thread; "Go to jar" sits at the card header's top right.
4. **Comment photo (D-95):** the thread's photo keeps the side margin and the app's photo radius.
5. **Previews with edits (D-96):** every moment preview shows the moment's edits.
6. **Jar page grid (D-97):** someone's day drops the cover band for a header and the Today-style 2 by 4 grid, cover badged.
7. **Cover discoverable (D-98):** Set as cover is an action in the owner's moment preview, and the cover tile carries a badge.
8. **Selfie camera (D-99):** #selfie opens on the front camera.

## Added after the plan (Nov 14)

The product owner sent three more round 3 items while H, I and J were being built. They are auto-approved on the same terms. Discover is the only one that needs a migration, and it is additive.

### R3-8 Discover: moments and jars from public people you don't read yet

- **Today:** Explore lists people and a few full jars, and there is no feed of public content from people the viewer doesn't read.
- **Change:** Explore becomes **Discover**, at the same `/explore` route (D-100). It is a feed of moments set to Everyone and published jars set to Everyone. Every item comes from an active person the viewer doesn't read. Blocked people (either way), and content that is removed, hidden or still checking, never show, and neither does the viewer's own (D-102). A compass button next to the bell on the Moments and Jars tabs opens it, and the empty Moments and Jars timelines point to it. The tab bar stays Today | Moments | Jars (D-101).
- **Schema:** migration 0070 adds two RPCs (Remote Procedure Calls), `discover_moments_page` and `discover_jars_page`, keyset-paged at 20 a page, with two partial indexes. Like the existing feeds they apply `can_view_moment`, `can_view_jar` and the block check. An Everyone moment in an unpublished or Readers jar shows under Moments, but its jar doesn't show under Jars. It is additive only: no drops or renames. pgTAP tests cover the owner, a reader, an outsider, a blocked person both ways, an inactive person, and removed or checking content.
- **Touches:** `supabase/migrations/0070_*.sql`, `supabase/tests/`, `src/features/explore/*`, `app/explore.tsx`, the Moments and Jars tab headers, `en.json`. **Design:** Explore (renamed Discover). **Risk:** cost of the page query; it is paged and indexed. **Size:** M.

### R3-9 Editor in two steps, like Instagram

- **Today:** one edit screen holds the photo tools (filters, stickers, text, crop and zoom) and the moment's details (caption, visibility) in a sheet that slides up over the photo.
- **Change:** step 1 is a full-screen photo editor with every existing tool and a **Next** button. Step 2 is a details screen with a 3:4 preview, the caption, visibility (Readers, Everyone, Only me) and the moment's other existing settings, then **Save** or **Share**. It adds no new social features: Pickld has no tags or mentions, so step 2 has none. The toolbar, parallax and Liquid Glass stay where they still fit. An edit already in the queue keeps working offline.
- **Touches:** `app/edit/[momentId].tsx`, `src/features/edit/*`, `app/publish.tsx` if it applies, `en.json`. **Design:** new EditPhoto and EditDetails screens in `design/screens/`, drawn in Instagram's style. **Risk:** an offline edit loses its step 2 state; drafts persist across both steps. **Size:** L. Decisions start at D-103.

### R3-M Thorough audit of the critical pages

- **Ask:** the same full-size, judged-like-a-user pass the share screen got, for every critical page.
- **Pages:** onboarding and the sign-in code, Today and a past day, camera, the editor (both steps, after L merges), moment preview, Moment detail and comments, the Moments and Jars timelines, the jar page (someone's day), profile (own and others), Stickers and the pack preview, Discover, Settings.
- **States, where they apply:** empty, 1 moment, partly full, 8 of 8, long captions and names, no avatar, Only me, offline and failed upload, large Dynamic Type, iOS 26 Liquid Glass and Reduce Transparency.
- **Method:** capture each page and state at full size in the Simulator, with a simulator-only fix for App Transport Security so photos load, and compare with `design/`. Judge balance, wasted space, alignment, consistent spacing, tap targets, readability and safe areas. Fix what looks bad and cut what can't be made to work, recording each as an auto-approved decision after L's numbers. Photo checks happen on the real iPhone. The product owner gets per-page contact sheets, then a phone rebuild.
- **Size:** L. It runs after L and may split into several pull requests by page.

### R3-G Liquid Glass tab bar, the real one

- **Ask:** "I am still not seeing the liquid glass bottom nav bar on my phone", with a screenshot of Apple's floating glass tab bar from another app.
- **Today:** the bar was real glass, but a custom one: a wide white-tinted bar with a border, a shadow and a solid green pill, so it read as frosted white rather than Apple's bar.
- **Change:** on iOS 26+ with Reduce Transparency off, the tab layout mounts Expo Router's `NativeTabs` (the system's floating Liquid Glass capsule, selected tab on a lighter glass pill), with the app's own icons; the custom bar stays below iOS 26 and with Reduce Transparency on. Screens drop the custom bar's bottom clearance under the native bar.
- **Touches:** `app/(tabs)/_layout.tsx`, `useLiquidGlass`, the three tab screens' bottom padding, `assets/tabs`, Main.html note. No schema.
- **Size:** S.

### R3-N Discover tab

- **Ask:** "Let's put the Discover to the bottom nav bar, beside the Jars."
- **Today:** Discover opens from a compass button next to the bell on the Moments and Jars tabs and from Find people, as a page stacked over the tabs; the tab bar is Today | Moments | Jars (D-101).
- **Change:** the tab bar becomes Today | Moments | Jars | Discover, with the compass icon, in both the system Liquid Glass bar (iOS 26+) and the custom bar (older iOS and Reduce Transparency). Discover moves into the tab (`app/(tabs)/discover.tsx`), drops its back button and keeps clear of the tab bar. The compass header buttons are removed; Find people opens the tab, and the old `/explore` link redirects to it, so Discover never opens as a stacked copy. Custom bar labels stay on one line and shrink a little to fit four tabs.
- **Touches:** `app/(tabs)/_layout.tsx`, `app/(tabs)/discover.tsx`, `app/explore.tsx`, `FloatingTabBar`, `TabBarButton`, `DiscoverView`, the Moments and Jars tab headers, `assets/tabs/discover*.png`, `scripts/render-tab-icons.mjs`, `en.json`, Main.html and Feed.html notes. No schema.
- **Size:** S.

## Pieces, order and parallel work (updated)

| Piece                     | Items          | Decisions       | Runs with                          |
| ------------------------- | -------------- | --------------- | ---------------------------------- |
| R3-H, R3-I, R3-J          | 1–7            | D-90–D-99       | merged (#328, #326, #327)          |
| R3-K Discover             | 8              | D-100–D-102     | L                                  |
| R3-L Two-step editor      | 9              | D-103–D-107     | merged (#331)                      |
| R3-G Glass tab bar        | owner's ask    | D-108           | before M; in the next rebuild      |
| R3-M Critical-page audit  | owner's ask    | after L         | after L merges; rebuild at the end |
| R3-N Discover tab         | owner's ask    | D-130           | after M's audit pull requests     |

## Decisions added (auto-approved Nov 14)

9. **Discover (D-100–D-102):** Explore becomes Discover at the same route and opens from a compass button next to the bell on the Moments and Jars tabs, with the tab bar unchanged. It shows Everyone moments and published Everyone jars from active people the viewer doesn't read, with no blocks either way and never the viewer's own.
10. **Two-step editor (D-103 onward):** the photo tools first, then Next to the details, then Save or Share. It adds no new social features.
11. **Critical-page audit (after L):** every fix or cut is recorded as its own decision.
12. **Glass tab bar (D-108):** iOS 26+ uses the system's Liquid Glass tab bar; older iOS and Reduce Transparency keep the custom bar.
13. **Moments tab icon (D-109):** a # (hashtag) in both bars. The editor keeps no crop tool; crop stays before the editor and in Re-crop (D-106, confirmed).
14. **Discover tab (D-130):** Discover is the fourth tab, beside Jars, in both tab bars; the compass header button is removed and `/explore` redirects to the tab. It replaces D-101's "tab bar unchanged".
