# Pickld 2.0 — Product & Screen Documentation

Nov 10, 2026 · @Eng

## Overview

Pickld 2.0 revives Pickld (formerly pickled.me) as a photo diary where each day is captured in eight fixed moments. The structure removes the question of what to post, and the tone removes the pressure to look perfect.

All screens referenced below live on the [Pickld design canvas](https://claude.ai/artifact/3Gbzk6SyaqjeFJSLc8QcCK). The **Hi-fi A** screens are the approved direction and the only designs on the canvas; each screen is named here exactly as its artboard is titled (for example, “Today”).

Photos on the canvas are placeholders from the open COCO dataset (Flickr, Creative Commons licenses), cropped to 3:4. They are fine for internal previews; replace them with shot or licensed photos before any public use, such as app store listings.

How it’s built: see the [Pickld 2.0 — Architecture Plan](https://claude.ai/artifact/78fJutkrNtA6a3Pi7GaAxL).

### Terminology

| Term | Meaning | Example in the UI |
| --- | --- | --- |
| Moment | One 3:4 photo filed under one of the eight hashtags | “#ootd · 7:30 AM” |
| Jar | A user’s set of moments for one calendar day (up to 8) | “5 of 8 moments in today’s jar” |
| Full jar | A jar with all 8 moments | “Full jar” tag, “Your Sunday jar is full” |
| Reader | Someone who follows you | “312 Readers” |
| Author | Someone you follow | “46 Authors” |
| Added later | Badge on a moment filled in after its day ended | Shown on the moment and the jar page |

### The eight moments

\#whereami · #mebusywith · #whoamiwith · #ootd · #selfie · #morning · #afternoon · #evening

### Brand lines

- Headline: “Eight moments. One real day.”
- Original lines kept as supporting copy: “You deserve to be you.” and “The easiest way to tell your story.”
- Primary color: #7fad33.

## Product rules

These rules apply to every screen and should be enforced in the database, not only in the app.

| Rule | Decision |
| --- | --- |
| Moments per jar | Up to 8, one per hashtag slot |
| Daily reset | A new jar starts at 00:00 in the user’s local time |
| Time zone | Locked to the device time zone at the jar’s first capture; after travel, the next jar starts at the new local midnight with a zone tag (e.g. “Tokyo time”) and a one-time banner explains the switch |
| Backfill | Any past day can be filled; those moments carry an “Added later” badge |
| Photo source | In-app camera or any gallery photo |
| Aspect ratio | Every moment is 3:4; gallery photos that aren’t 3:4 go through Crop |
| Editing | Stickers, speech bubbles, text and color filters; no beauty or retouch filters |
| Default visibility | Readers; per jar: Readers, Everyone or Only me |
| Private moments | Any single moment can be private and is excluded when the jar is published |
| Counts | Reader, author and reaction counts are public |
| Reminders | One gentle reminder per time slot (morning, afternoon, evening), skipped if that slot is filled; times editable |
| Minimum age | 13+, checked by birthday at sign-up |
| Monetization | Free at launch; later, premium sticker packs (and possibly special jar lids) and ads in feeds only, never inside a user’s own jar |
| Launch | Global from day one, for everyone |
| Personalization | Onboarding answers (day type, who’s in your days, what keeps you busy, usual outfit) are private; they set default reminder times and sticker suggestions. Jar lid color is chosen at onboarding and changeable later. |
| Pickld Promise | Shown once at the end of onboarding; skippable; stored with the date it was accepted. |

## Navigation map

The floating tab bar (Today · Capture · Jars · My days) is the spine; every other screen opens from one of those four tabs.

&#91;embedded content: Navigation map · onboarding, tab bar and the screens under each tab\]

Indented boxes open from the box above them. Two shortcuts cross tabs: Today’s moment tiles and the day page’s empty tiles (from My days’ **Fill this jar**) both open Capture, and the empty Jars state opens Explore.

## Onboarding

Onboarding is the first impression of Pickld, so it teaches the idea before asking for anything, keeps setup playful, and ends with the user taking their first moment. It runs in two parts: intro and account (6 screens), then a fun 6-step setup, a promise and a first-moment tip.

| # | Screen (artboard) | Purpose | Main action → next |
| --- | --- | --- | --- |
| 1 | Welcome | Collage of 3:4 photos, logo, “Eight moments. One real day.” | Get started → How it works 1 · I already have an account → Sign in |
| 2 | How it works 1 | “Eight moments a day”: the 8 hashtags as a grid, some filled | Next → How it works 2 |
| 3 | How it works 2 | “Every moment fills your jar”: the jar at 5 of 8, midnight reset, backfill | Next → How it works 3 |
| 4 | How it works 3 | “You deserve to be you.” No beauty filters, private moments, you pick who reads | Create my account → Sign up |
| 5 | Sign up | Apple, Google or email; link to Sign in | Continue with email → About you |
| 6 | Sign in | Returning users: Apple, Google or a 6-digit email code (no password) | Send sign-in code → Check your email |
| 7 | About you (step 1 of 6) | Photo, name, username with availability check, birthday | Continue → Your day |
| — | Under 13 | Shown if the birthday is under 13; nothing entered is saved | Back to start → Welcome |
| 8 | Your day (step 2 of 6) | “What’s your day like?” Early bird, Coffee first or Night owl; the answer sets the three reminder times, shown with a Change button | Continue → Your people |
| 9 | Your people (step 3 of 6) | One-tap chips: who’s in your #whoamiwith, what your #mebusywith is, your honest #ootd. Private; used to suggest stickers | Continue or Skip → Pick your jar |
| 10 | Pick your jar (step 4 of 6) | Choose a jar lid color (Pickle, Mango, Ube, Sunset, Sky, Ink); shown on the profile and jar card | Continue → Permissions |
| 11 | Permissions (step 5 of 6) | Camera, Photos, Notifications; notifications names the chosen times | Continue → Find friends · Maybe later |
| 12 | Find friends (step 6 of 6) | Match contacts, copy invite link (pickld.me/username), people already on Pickld | Continue or Skip → Pickld Promise |
| 13 | Pickld Promise | A signed card: post the real stuff, messy counts, be kind about others’ ordinary days; hold-to-promise button | Hold → First moment tip · Skip |
| 14 | First moment tip | Sheet over the first-day Today: the current slot is ready, three tips | Take my first moment → Capture · Look around first → Today, first day |

### Why it’s built this way

- **Teach, then ask.** The three How it works screens explain moments, jars and the no-pressure tone before any form. Each has Skip for people who already know Pickld.
- **Quiz, not a form. Your day sets reminder times without a time picker, Your people tunes sticker suggestions, and Pick your jar adds a sense of ownership; each is one tap and changeable later. Choosing times before the notification prompt also gives that prompt a concrete reason. The Pickld Promise is a small commitment moment that makes the no-pretending culture explicit from day one**
- **Friends early, but skippable.** An empty Jars feed is the biggest early drop-off risk, so finding friends is a full step.
- **End on a capture, not a feed.** The tip sheet points straight at the current moment so the first jar starts in the first session.
- **Under-13 handling** stores nothing, to stay within child-privacy rules such as COPPA.

### What to measure

Sign-up completion rate, the share of new users who capture a first moment on day one, notification opt-in, friends found per new user, and how many skip the intro.

## Core capture loop

The daily loop is Today → Capture (or Crop for gallery photos) → edit tools → back to Today → Publish review.

### Today — “Today”

The home screen and the first tab. The header shows the date, a greeting by time of day, a Stickers shortcut, a My days shortcut and the user’s avatar.

- **Jar card (dark):** a jar graphic filled to the number of moments, “5 of 8 moments in today’s jar · 312 readers”, and the **Publish** button.
- **Moment grid (2 columns, 8 tiles):** filled tiles show the photo, capture time and hashtag; empty tiles are dashed with a “+”; the current time slot is a dark “Now · Tap to capture” tile. A tile that fills pops in as the jar's fill rises (D-58).
- Floating tab bar: Today · Capture · Jars · My days.

Goes to: tile → Capture (that slot) or Moment detail if filled · Publish → Publish review · avatar → My profile · stickers icon → Stickers · calendar icon → My days.

### Capture — “Capture”

The photo editor for one moment. A dark frosted toolbar at the top holds Close, the slot tag with time, and Save (D-59); iOS 26 and later draw it as Liquid Glass (D-57). The photo sits below it; stickers and speech bubbles sit on the photo.

- Bottom sheet: tool tabs (Filters · Stickers · Bubble · Text), filter thumbnails (Original, Kalamansi, Merienda, Mono, Dusk) previewing the actual photo, caption field, **Keep this moment private** switch, Undo. Swiping up slides the sheet over the photo, which moves up more slowly and shrinks a little (off with Reduce Motion).
- **Add to #afternoon** in the toolbar saves the moment into today’s jar (**Done** when editing it again).

Goes to: gallery → Crop · tool tabs → Stickers / Bubble / Text · Close or save → Today.

### Crop — “Crop to 3:4”

Shown for gallery photos that aren’t 3:4, and when a user re-crops while editing. Camera photos are already 3:4 and skip it. Edit profile also opens it for a new avatar (square, circle guide) or cover (5:2), with pan, zoom and Reset only (D-79).

- Fixed 3:4 frame with a lock chip, rule-of-thirds grid, corner handles and dimmed overflow.
- Drag to reposition, pinch or slider to zoom; Rotate, Flip and Fit; Cancel and Reset in the header.
- **Next: edit** → Capture.

### Stickers, Bubble and Text — “Stickers tool”, “Bubble tool”, “Text tool”

The three remaining editor tabs share the Capture layout, with a crop button in the top right, Undo and **Done** at the bottom. The selected overlay shows a dashed outline, a delete handle and a resize handle.

- **Stickers:** search, categories (Popular, Words, Filipino, Time) and a grid of word stickers such as “Kape muna” and “Real ako”.
- **Bubble:** shapes (Speech, Thought, Shout, Whisper), six colors and the bubble text field.
- **Text:** fonts (Clean, Bold, Type, Serif), colors, size slider and alignment.

### Publish review — “Publish review”

Confirms what will be shared before a jar goes out.

- Grid of all 8 slots in 3:4, with empty ones dashed and private ones marked with a lock.
- **Who can see this jar:** Readers (default), Everyone, or Only me (“Keep this jar just for you”).
- Note: private moments aren’t shared; missing moments can still be added today.
- **Publish jar** → Today (published state), with a short confetti burst and the jar's lid closing (D-58) · **Not yet** → Today.

## Jars and social

These screens cover reading other people’s jars, reacting, and managing who reads you.

### Jars feed — “Jars”

The third tab, showing jars from authors the user reads.

- Avatar row of authors with green rings for new jars.
- Jar cards: avatar, name, “Updated 2h ago”, a jar count pill (for example 6/8), a photo mosaic (the jar’s cover large, three small, and a “+2” tile), reactions, comments and the last caption.
- Bell with an unread dot.

Goes to: card or “+2” → Jar page · avatar → Other profile · bell → Notifications.

### Jar page — “Jar”

One person’s full jar for one day. A cover photo carries the author, “Dale’s Sunday”, the date, the moment count and a “Full jar” tag when complete. The owner picks the cover with **Set as cover** (D-56); without a pick, or for someone who can’t see the picked moment, it is the moment with the newest caption, else the first in slot order (D-75). The same cover leads the feed card, the share card and the web page.

- A highlighted caption, then a 3-column grid of moments in 3:4 with hashtag labels and an “Added later” badge where relevant, ending with an 8/8 tile.
- Floating action bar: like count, comment count, **Share jar** (on your own jar only; D-83).

Goes to: moment → Moment detail · comments → Comments · Share jar → Share jar card.

### Moment detail — “Moment detail”

A single moment full screen in 3:4, with eight progress bars showing its place in the jar (swipe for the next). The sheet shows the hashtag, time and date, caption, likes, comments and, on your own moment, share (D-83).

### Comments — “Comments”

The thread for one jar, with avatars, names, times, likes per comment, one level of replies, and an input bar with send.

### Share jar card — “Share jar card”

Previews the 9:16 image exported for other apps: author, day title, the moments in the chosen layout, the last caption, the Pickld logo and pickld.me/username. The photos fill the card less a thin margin, with the name, caption and link on small pills inside the band Instagram leaves uncovered (D-82). Only your own jars and moments can be shared; someone else's jar shows “You can only share your own jars” (D-83).

- **Include captions** switch; Save image, Copy link, Message, More; **Share to…**
- The watermark and link make every share a way for new users to find Pickld.

### My profile and Other profile — “My profile”, “Other profile”

Both share one layout: cover photo, large avatar, name, @username, bio, Readers · Authors · Jars counts, a Jars / Moments switch, and a 3-column grid of past jars labelled with date and count.

- **My profile:** Edit profile, Share profile, Settings and a **Stickers** row (D-61).
- **Other profile:** **Read her days** (follow), a “Reads you” tag, and a menu for Report and Block.

Goes to: counts → Readers & authors · jar → Jar page · settings → Settings · Stickers → Stickers · menu → Report.

### Readers & authors — “Readers & authors”

A switch between 312 Readers and 46 Authors, a search field, and rows with avatar, name, @username and a Reading or Read back button.

### Notifications — “Notifications”

- A pinned reminder card for the current slot with a **Capture** button.
- Today and This week groups: new readers (with Read back), likes and comments (with a thumbnail of the moment), full-jar milestones, and friends joining.

## My days, memories, discovery and empty states

### My days — “My days”

The fourth tab: a month calendar of the user’s own jars and the entry point for backfilling.

- Each past day shows that day’s cover photo and a thin green bar for how full its jar is; today is outlined in green; future days are disabled.
- The selected day card shows a small jar graphic, the moment count, the captured moments, dashed slots for missing ones, and “+ #hashtag” chips.
- **Fill this jar** → that day’s page (D-55) · **View jar** → Jar page.

### Day page — “Day”

A past day’s page (`/day/[date]`, D-55), opened by **Fill this jar** on My days. It works like Today for that date: Back and the date instead of the greeting, the same dark jar card and 8 tiles, no Now tile, and a note that moments added now show “Added later”.

- Empty tile → Capture for that day and slot (the server marks it “Added later”) · filled tile → Moment preview of that day’s moments · **Publish** → Publish review for that day’s jar while it isn’t published · the Published chip → who can see the jar.

### Memories — “Memories”

Resurfaces past jars: an “On this day” card from one year ago, a monthly recap (moments, full jars, top hashtag, a photo strip and **Play**), and a year summary that can later become a printed year book.

### Explore — “Explore”

Search by name or @username, Suggested authors with a **Read** button, and a grid of “Full jars today” from public jars.

### Empty and first-use states

- **“Today, first day”:** an empty jar graphic with “Your first jar. Eight moments fill it up,” all 8 tiles empty, and the current slot (#morning) highlighted as Now. This is where onboarding ends.
- **“Jars, empty”:** “Your feed is quiet,” **Find people** → Explore, Invite friends, and People you may know.

## Settings and safety

Report, block and account deletion are required by both app stores for apps with user photos, so these ship at launch.

### Settings — “Settings”

- Account card: avatar, name, @username, email, **Edit**.
- **Reminders:** Morning, Afternoon and Evening, each with an editable time and an on/off switch.
- **Privacy:** Default visibility (Readers), Blocked accounts, My stickers (opens Stickers on Mine). Data download lives on the Delete account screen
- **Account:** Help & feedback, Terms & privacy policy, Sign out, Delete account (both in red).

### Report — “Report”

A bottom sheet over the reported profile. Report / Block switch at the top, then reasons: nudity or sexual content, harassment or bullying, violence or dangerous acts, hate speech or symbols, spam or scam, involves someone under 13, something else. The reporter stays anonymous. **Submit report** sends it to the moderation queue.

### Block — “Block”

A confirmation dialog: the blocked person can’t see your jars or find your profile, and isn’t told. **Block** (red) or Cancel.

### Delete account — “Delete account”

States what will be removed (jars, moments, profile, readers, comments, reactions), offers **Download** of all photos and captions first, requires typing DELETE, then **Delete my account** (red) or Keep my account.

## Extra screens and states

These screens fill the gaps that shape the architecture: offline saving, the upload pipeline, moderation and time zones. They sit in the last four rows of the canvas.

| Screen (artboard) | What it shows | Leads to |
| --- | --- | --- |
| Camera | Live 3:4 viewfinder with grid, slot tag and time, flash, moment switcher, shutter, gallery and flip | Shutter → Capture · gallery → Crop |
| Moment preview | Full-screen preview of your own moment from Today or a past day’s page (D-54, D-71, D-74): photo with edits, slot, time, visibility, a “Cover” label on the jar’s cover, caption, likes and comments; swipe through that day’s moments; bar with Edit, Share, Visibility and More (only Edit and Delete for a photo not uploaded yet) | Edit → Capture · Share → Share card · Visibility and More → Moment options |
| Moment options | Sheet on a moment: edit caption, edit stickers and filters, re-crop, visibility, move to another moment, set as cover (D-56), delete. From the moment preview, More shows only re-crop, move, set as cover and delete, and Visibility opens its page directly. Set as cover is hidden on the current cover and on photos not uploaded yet | Re-crop → Crop |
| Today, published | Today after publishing: “Published” chip, likes count, and a note that new moments today go out automatically | — |
| Full jar | Celebration when a jar reaches 8 of 8, with the jar number | Publish jar → Publish review · Share jar card |
| Time zone banner | “You’re in Tokyo time”: today’s jar stays on Manila time until it closes; the next jar follows local time | Got it dismisses |
| Upload & offline | Offline banner plus tile states: waiting for connection, uploading with progress, and failed with Retry | — |
| Checking photo | New photo blurred while the safety check runs; only the owner can see it meanwhile | Back to today |
| Moment removed | Notice naming the guideline broken, with Request a review and a link to the guidelines | Help |
| Camera access off | What Capture shows when camera permission is denied | Open Settings · Choose from gallery instead |
| Check your email | After a sign-in code is sent: six code boxes (checked at the 6th digit), open email app, resend timer, use a different email | Today |
| Report sent | Confirmation after a report, with an option to also block | Block · Jars feed |
| Edit profile | Cover, avatar, name, username, bio with character count, jar lid picker. Change photo and Change cover open Crop as a square with a circle guide or at 5:2, pan and zoom only; **Use photo** uploads that crop, Cancel changes nothing (D-79) | Save → My profile |
| Blocked accounts | Blocked people with Unblock | — |
| Help & feedback | Search, common questions, contact support, send feedback, community guidelines | — |
| Shared link web page | What a non-user sees at pickld.me/dale: the shared jar, the tagline and App Store / Google Play buttons | Open in the app |
| Home screen widgets | Medium widget with today’s jar and a capture button; small widget with a friend’s latest moment | Camera · Jar page |
| Notification designs | Lock-screen examples for a slot reminder, a new reader and likes on a jar | — |

Architecture implications: moments are saved on the phone first and uploaded in the background with retry; every photo passes a moderation check before others can see it; removals need an appeal queue; widgets need a small shared data store on the phone; and the shared-link page needs a public, cacheable view of jars marked Everyone or shared by link.

## Brand and operations

### App icon — “App icon”

Recommended: **A · Classic mark**, the original Pickld mark in white on #7fad33, shown at 120, 76, 60, 40 and 29 px. Alternatives on the canvas: B · The jar (cream background) and C · Night (green mark on ink).

Delivery: a 1024 px master with no transparency for iOS; an Android adaptive icon with separate foreground and background layers; a themed monochrome version for Android 13+; the mark kept inside the center 66% safe zone.

### Splash screen — “Splash screen”

Solid #7fad33 with the white mark and “Pickld” wordmark, eight small squares that fill like moments while the app loads, and “Eight moments. One real day.” at the bottom.

### Moderation console — “Moderation console (web)”

An internal web tool for the moderation team, designed at desktop size (1280 × 800).

- **Sidebar:** Queue, Reports, Appeals, Users, Sticker packs, Audit log, with counts.
- **Header stats:** pending items, median wait, open appeals.
- **Queue:** oldest first, filterable by All, Auto-check, Reports, Appeals and Escalated. Thumbnails stay blurred; each row shows source, reason, user and wait time.
- **Detail panel:** blurred photo with Show photo, the flag and its score, caption, the user’s history, and current visibility.
- **Actions:** Keep (K), Remove (R), Remove and warn, Escalate (E). Every action is written to the audit log.

Child safety content is never reviewed in the regular queue: suspected CSAM is blocked on upload by the scanning service and goes straight to the legal reporting flow, handled by a small trained group.

## Accessibility

All Hi-fi A screens were checked for text contrast, text size, touch target size and labels. White text on #7fad33 is Pickld’s signature and is kept by decision; everything else should meet the WCAG AA guideline (4.5:1 for normal text).

| Check | Result | Action |
| --- | --- | --- |
| Text contrast | Passes everywhere except sticker art on orange, blue and purple | Sticker colors darkened: #e8743b → #c4521c, #4a9ad4 → #2f74a8, #8e6fc4 → #6f4fae (all now 4.5:1 or better) |
| Text size | Labels at 9–10 px on the How it works grid, profile jar tiles, Publish review and jar page badges | Raised to 11 px minimum. Only the shrunken share-card preview and tiny sticker thumbnails stay smaller, as illustrations |
| Touch targets | About 120 controls are 32–42 px tall (pills, chips, tabs, swatches) | Keep the look; extend each tap area to at least 44 × 44 px in code with `hitSlop` |
| Labels | Every icon-only button has an accessible name | Carry these over as `accessibilityLabel` in React Native |
| Disabled controls | “Next month” on My days is low contrast | Allowed for disabled controls; also mark it disabled for screen readers |

### Rules for the React Native build

- **Screen readers:** label every moment by slot, time and state (“#ootd, 7:30 AM, private”); announce the jar as “5 of 8 moments”; group each photo with its caption.
- **Larger text:** support the system text size (Dynamic Type on iOS, font scale on Android) up to at least 200%; let cards grow rather than truncate.
- **Reduce motion:** when the system setting is on, skip confetti and replace the jar-filling animation with a simple fade; tile, heart and lid pops fade in place too (D-77).
- **Don’t rely on color alone:** private moments show a lock icon, failed uploads show a warning icon and text, and the calendar shows counts, not just shades.
- **Photos:** moment photos get alt text from the hashtag and caption; decorative images are hidden from screen readers.
- **Haptics:** a light tap when a slot fills (the 8th too) and on a like, and a success tap on publish (D-58), never as the only feedback.
- **Success toasts:** read aloud when they appear (`announceForAccessibility`), fade instead of sliding with Reduce Motion, and can be dismissed by the screen reader's Close action.

## Design system

Every value below should live in one theme file that both the app and future designs read from.

### Color

| Token | Value | Use |
| --- | --- | --- |
| brand | #7fad33 | Primary buttons (white text), jar lid and layers, Now chip, active states |
| brand-tint | #e6f1d3 | Count pills, active tab pill, success icons |
| brand-text | #2c470a / #3f6510 | Green text and links on light backgrounds |
| ink | #11140d | Body text, dark cards, selected tool tab |
| muted | #565e50 | Secondary text |
| background | #f4f5f0 | App background |
| surface | #ffffff | Cards, sheets, tab bar |
| subtle | #f0f2ec | Secondary buttons, chips, segmented controls |
| border | #dfe2d8 | Inputs, dashed empty slots (#c9cfc0) |
| danger | #b42318 | Block, Sign out, Delete account |

Note: white text on #7fad33 is below the accessibility contrast guideline. This was a deliberate brand choice; keep button labels bold and at least 14 px.

### Type

Plus Jakarta Sans throughout. Screen titles 32/800 with –0.03em tracking; section titles 17–20/700–800; body 14–15/500–600; captions and labels 11–13/600–700.

### Shape and depth

- Radii: 10–14 small thumbnails, 16–22 tiles, 24 cards, 26 tab bar, 30 sheets, full pills for buttons and chips.
- Shadows: soft card (0 2 10, 6% ink) and floating (0 8 28, 14% ink) for the tab bar and action bars.
- Frosted glass on controls over photos and on the tab bar. On iOS 26 and later these draw as Apple's Liquid Glass: the tab bar, round glass buttons, the editor toolbar, the moment preview's action bar and Moment detail's top buttons (D-57, D-76). Below iOS 26, or with Reduce Transparency on, they keep the frosted blur.

### Photos

All moments are 3:4. Tiles may crop to squares only in tiny thumbnails (calendar cells). Dark fades at the bottom of photos keep white labels readable.

### The jar graphic

A glass jar with a #7fad33 lid and 8 stacked layers that fill from the bottom, alternating #7fad33 and #94c04a. Sizes in use: 52 px (Today card), 20–22 px (My days, notifications), 14–16 px (count pills, Full jar tag). In the app, animate a layer settling in each time a moment is added.

### Jar lids

Users pick a lid color in onboarding (Pick your jar) and can change it later. The lid shows on every jar they fill, their profile and the jar card. Layers stay brand green so jars still read as Pickld.

| Lid | Hex |
| --- | --- |
| Pickle (default) | #7fad33 |
| Mango | #f2b632 |
| Ube | #8e6fc4 |
| Sunset | #e8743b |
| Sky | #4a9ad4 |
| Ink | #11140d |

### Core components

Floating tab bar · round icon button (light and glass) · primary, secondary and danger buttons · pill button · moment tile (filled, empty, Now) · photo tile with fade and label · jar graphic · jar card · card · list row · toggle · segmented control · text field · chip · avatar · bottom sheet · dialog · toast.

**Toast** (D-63): the one success message in the app. A short dark pill under the status bar with a check and one line, for a moment added, saved, moved or deleted, a jar published, a link copied, an image saved, a profile change, reading or blocking someone, and a sticker pack added. It leaves after about 2.5 seconds or with a swipe up, a new one replaces it, the screen reader reads it aloud, and with Reduce Motion it fades instead of sliding. It never shows a photo or caption. Errors keep their inline messages and alerts.

## Sticker sets

Stickers launch free with a generous core set, then premium packs become Pickld’s first paid product alongside feed ads. The free set must stay good enough that the app never feels locked.

### Principles

- **Honest, not polished.** Stickers celebrate ordinary days: traffic, leftovers, pambahay. No face-altering or beauty stickers, matching the no-retouch rule.
- **Words first.** Most stickers are short phrases, which are cheap to make, easy to translate, and fit Pickld’s voice.
- **Filipino-first, global-ready.** Lead with Filipino and Taglish humor, and add English and other languages pack by pack.
- **Viewers never pay.** Anyone viewing a jar sees every sticker on it; only the person adding a sticker needs to own its pack.
- **12 to 24 stickers per pack,** each designed to sit on a 3:4 photo and read on the jar card export.

### Sticker types

| Type | What it is | Example |
| --- | --- | --- |
| Word stickers | Short phrases in pill, tag or cut-out styles | “Kape muna”, “Real ako” |
| Moment stickers | One set per hashtag slot, suggested first in that slot | #ootd: “Pambahay”; #whereami: “Traffic again” |
| Auto stamps | Filled in from the moment itself | “2:14 PM”, “Mon, Nov 9”, “Jar #128” |
| Doodles and shapes | Arrows, circles, hearts, underlines | Hand-drawn arrow pointing at a detail |
| Bubble styles | Extra speech bubble shapes and textures | Comic burst, sticky note |
| Earned stickers | Unlocked free by milestones, never sold | “First full jar”, “100 jars”, “Pickld OG” for launch-month users |

### Pack catalog

| Pack | Tier | Example stickers | Timing |
| --- | --- | --- | --- |
| Everyday | Free | Real ako, Kape muna, Busy bee, Lunch break, Ordinary day, Monday mood, Rain again | Launch |
| The Eight | Free | 3 stickers per moment slot | Launch |
| Stamps | Free | Time, date, jar number | Launch |
| Milestones | Earned | First full jar, 7 full jars, 30 jars, 1 year of jars | Launch |
| Pinoy Life | Premium | Traffic na naman, Ulam check, Petsa de peligro, Sana all, Sweldo day | First paid release |
| Barkada | Premium | Squad goals, Kain tayo, Libre mo?, Inuman (soft drinks edition) | First paid release |
| Family | Premium | Lola’s cooking, Pasalubong, Video call with Mom | Second release |
| Work From Wherever | Premium | Meeting could’ve been an email, Camera off, OOO | Second release |
| Pet Parent, Foodie, Honest Gym, Travel | Premium | Global packs in English first | Ongoing |
| Seasonal | Premium, time-limited | Valentine’s, Summer, Rainy season, Back to school, ’Ber months, Christmas (Simbang Gabi, Noche Buena) | Around each season |
| Artist collabs | Premium | Packs drawn by Filipino illustrators | After the first paid releases |

### Pricing and business model

- **Single packs:** one low price per pack, set in local currency through app store pricing tiers.
- **Seasonal packs:** sold only during their season, then retired; owners keep them.
- **Pickld+ (later):** a subscription that includes every pack, plus the premium features planned for later (full-resolution archive, year book export).
- **Artist collabs:** revenue share with the illustrator; the exact split is still to be decided.
- **Sponsored packs (optional):** a brand-themed pack clearly labelled as sponsored, kept rare so stickers don’t feel like ads.
- Apple and Google take 15% to 30% of in-app purchases, which needs to be built into pricing.

### How it works in the app

- **Catalog from the server:** packs and stickers live in Supabase (`sticker_packs`, `stickers` with tier, tags, locale and asset path) and download on demand, so new packs ship without an app update.
- **Ownership:** an `owned_packs` table, with purchases verified on the server. A service such as RevenueCat simplifies receipts and subscriptions across iOS and Android.
- **Rendering:** stickers are SVG or PNG drawn with Skia. Each moment saves sticker id, position, scale and rotation, so jars and the jar card can be re-rendered at any size.
- **In the Stickers tool:** the slot’s Moment stickers appear first, owned packs next, and locked premium packs show a small lock that opens a pack preview.
- **Screens (Sticker module row on the canvas):** Stickers tool (pack tabs led by stickers suggested for the current slot, plus a shop banner), Stickers (one page with a Mine | Shop switch, D-61; opened from Today’s header, My profile, Settings and the Stickers tool’s shop banner), whose Shop is the Sticker shop (seasonal banner, “For you” from the onboarding answers, owned and earned packs; each pack card shows a cluster of up to six of its stickers, D-81) and whose Mine is My stickers (reorder or hide packs, restore purchases), Pack preview (a cover of the pack’s stickers, large, on its color, with no photo, D-81; all stickers; “Get Pinoy Life · ₱49”), and Sticker unlocked (earned-sticker celebration with milestone progress)

### What to measure

- Share of moments with at least one sticker (shows whether stickers fit the habit).
- Most-used free stickers (shows which themes to turn into paid packs).
- Pack preview to purchase conversion, and revenue per paying user.

### Rollout

1. **Launch:** Everyday, The Eight, Stamps and Milestones, all free (about 50 stickers).
2. **After launch:** turn on purchases with Pinoy Life and Barkada, plus the first seasonal pack.
3. **Ongoing:** one new pack a month and a seasonal pack each season; artist collabs once usage data shows what sells.

## React Native implementation and open questions

The app is built with React Native (Expo) on Supabase. Build the component kit first, compare each piece against the design canvas in an in-app gallery screen, then assemble screens.

| Design element | React Native approach |
| --- | --- |
| Styling and tokens | NativeWind with the theme above |
| Navigation and floating tab bar | Expo Router tabs with a custom tab bar; `GlassSurface`: `expo-glass-effect` Liquid Glass on iOS 26+, `expo-blur` below that or with Reduce Transparency on (D-57) |
| Photos | `expo-image`, fixed 3:4 |
| Photo fades | `expo-linear-gradient` |
| Camera | `react-native-vision-camera`, 4:3 format so output is 3:4 |
| Crop | `react-native-gesture-handler` + Reanimated; `expo-image-manipulator` for the final crop |
| Filters, stickers, bubbles, text | React Native Skia |
| Share jar card export | Skia snapshot or `react-native-view-shot` |
| Bottom sheets | `@gorhom/bottom-sheet` |
| Jar graphic and fill animation | Skia or `react-native-svg` + Reanimated |
| Reminders | Local scheduled notifications (`expo-notifications`) |
| Social notifications | Expo push service, triggered from Supabase |

### Open questions

- [ ] Copy review of the onboarding screens with a few first-time users.
- [ ] Tab names: keep “Jars” next to “My days”, or rename My days to Calendar?
- [ ] Trademark and app store search for “Pickld” and “Jar” wording.
- [ ] Review the new extra screens and states (feedback pending).
- [ ] Whether “Everyone” jars appear in Explore by default or only when opted in.
- [ ] Sticker pack pricing per region (₱49 in the designs is a placeholder) and the artist revenue share.
- [ ] Replace placeholder photos and refresh sample captions to match them.
