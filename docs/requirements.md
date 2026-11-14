# Pickld 2.0 — Functional Requirements

Nov 10, 2026 · @Eng

## How to use this document

This is the checklist of what Pickld 2.0 must do. Each requirement has an ID, a priority and acceptance criteria that a person or a coding agent can test. Screen names match the [design canvas](https://claude.ai/artifact/3Gbzk6SyaqjeFJSLc8QcCK); the why lives in the [Product & Screen Documentation](https://claude.ai/artifact/PboNAB1FCxs72bDLZYr7tW) and the how in the [Architecture Plan](https://claude.ai/artifact/78fJutkrNtA6a3Pi7GaAxL).

- **IDs** look like FR-JAR-03 (area, number) and never change once used; deleted requirements leave a gap.
- **P0** ships at launch (end of week 12). **P1** ships in the first one to two months after launch.
- **Done** means every acceptance criterion passes on both iOS and Android, including with the phone offline where noted.

### Terms

| Term | Meaning |
| --- | --- |
| Moment | One 3:4 photo in one of 8 slots: #whereami, #mebusywith, #whoamiwith, #ootd, #selfie, #morning, #afternoon, #evening |
| Jar | One user’s moments for one local date, up to 8 |
| Reader / Author | Someone who follows you / someone you follow |
| Added later | Badge on a moment added after its jar’s day ended |

## Accounts and onboarding

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-ACC-01 | Sign up with Apple, Google or an email code | Each method creates an account and lands on About you; no passwords exist anywhere | P0 | Sign up |
| FR-ACC-02 | Sign in for returning users | Apple and Google sign in directly; email sends a 6-digit code (valid 10 minutes) and shows Check your email with the code field and a 60-second resend timer; the code opens Today | P0 | Sign in, Check your email |
| FR-ACC-03 | Unique username | 3–20 characters, letters, numbers, dot and underscore; case-insensitive unique; availability shown live within 500 ms of typing stopping | P0 | About you, Edit profile |
| FR-ACC-04 | Minimum age 13 | Birthday required; under 13 shows Under 13 and deletes everything entered, including the auth record | P0 | About you, Under 13 |
| FR-ACC-05 | Profile basics at sign-up | Photo (optional), name (1–40 characters), username, birthday saved before Continue | P0 | About you |
| FR-ONB-01 | Intro screens | Three How it works screens with Skip on each; Skip goes to Sign up | P0 | How it works 1–3 |
| FR-ONB-02 | Your day quiz sets reminder times | Early bird = 7:00 AM, 12:30 PM, 7:00 PM; Coffee first = 8:30 AM, 1:00 PM, 8:00 PM; Night owl = 10:00 AM, 3:00 PM, 9:30 PM; Change opens a time picker; saved to reminder settings | P0 | Your day |
| FR-ONB-03 | Your people quiz | Multi-select chips for #whoamiwith, #mebusywith and #ootd; skippable; saved privately to onboarding answers | P0 | Your people |
| FR-ONB-04 | Pick your jar lid | Six colors, Pickle selected by default; saved to profile; changeable in Edit profile | P0 | Pick your jar |
| FR-ONB-05 | Permissions with reasons | Camera, Photos and Notifications each show a reason card before the system prompt; Notifications names the chosen times; Maybe later skips all | P0 | Permissions |
| FR-ONB-06 | Find friends | Contacts matched by hashed phone number only; invite link copies pickld.me/username; Read buttons follow; Skip available | P0 | Find friends |
| FR-ONB-07 | Pickld Promise | Hold for 1.5 seconds to accept (progress ring); timestamp saved; Skip allowed and not asked again | P0 | Pickld Promise |
| FR-ONB-08 | First moment tip | Shown once over the first-day Today; Take my first moment opens Camera on the current slot | P0 | First moment tip, Today, first day |
| FR-ONB-09 | Progress and resume | Steps show “Step n of 6”; quitting mid-setup resumes at the same step on next launch | P0 | Setup screens |

## Today, jars and days

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-JAR-01 | Today shows the current jar | Header shows date and a time-of-day greeting; jar card shows the jar graphic filled to the moment count, “n of 8 moments” and reader count; grid shows 8 slots in fixed order | P0 | Today |
| FR-JAR-02 | Slot tile states | Filled: photo, time, hashtag. Empty: dashed with +. Current slot: dark “Now · Tap to capture” tile (morning 5:00–11:59, afternoon 12:00–17:59, evening 18:00–23:59; other slots never show Now). Tapping a filled tile opens the moment preview (D-54, D-71): the 3:4 photo with its edits, slot, time, visibility, caption, likes and comments, swiped left and right through today’s moments in slot order (adjustable for screen readers). A live moment’s bar has Edit, Share (off for Only me), Visibility and More (Re-crop, Move, Delete); a photo not uploaded yet previews from the phone with only Edit and Delete, and none while it uploads. Checking and removed tiles keep their own screens. A tile that fills pops in with a light haptic while the jar card's fill rises, and the preview fades and grows in from a tile (D-58, D-77) | P0 | Today, Moment preview |
| FR-JAR-03 | One moment per slot | A second moment in a filled slot is refused by the database; the app offers Replace, which keeps the old photo until the new one uploads | P0 | Today, Camera |
| FR-JAR-04 | Local midnight reset | At 00:00 local time Today switches to a new empty jar without restarting the app; yesterday’s jar moves to My days | P0 | Today |
| FR-JAR-05 | Travel time zones | An open jar finishes in the zone it started in; the next jar uses the phone’s current zone and shows the Time zone banner once with a zone tag on that jar | P0 | Time zone banner |
| FR-JAR-06 | Added later badge | A moment added after its jar’s end (next local midnight in the jar’s zone, by server time) shows “Added later” everywhere it appears; changing the phone clock cannot avoid it | P0 | Jar, My days |
| FR-JAR-07 | Full jar celebration | Adding the 8th moment shows the Full jar celebration once, with the jar number; Reduce Motion replaces confetti with a fade | P0 | Full jar |
| FR-JAR-08 | Jar counts | Profile jar count and “jar number” count only jars with at least one moment | P0 | Profile, Full jar |

## Capture, crop and editing

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-CAP-01 | Camera | Live 3:4 preview with grid, slot tag and time, flash, front/back flip, gallery shortcut, a brand-green shutter; front-camera photos are saved mirrored, as previewed, unless Mirror selfies is off in Settings (then flipped back; D-66); the slot comes from the tile that opened it (read-only tag, no switcher; without one, the Now slot, else the first empty); shutter goes to the editor in under 1 second | P0 | Camera |
| FR-CAP-02 | Gallery import | Any gallery photo can be chosen; photos that aren’t 3:4 open Crop first; photos taken on a past date go into that date’s jar and get Added later | P0 | Camera, Crop |
| FR-CAP-03 | Crop | Fixed 3:4 frame; drag, pinch and slider zoom; Rotate 90°, Flip, Fit and Reset tools; Cancel and the main button (Next: edit / Save crop) in the header; the tools sheet fits without scrolling at normal text sizes (D-65); result is 1440 × 1920 | P0 | Crop |
| FR-CAP-04 | Color filters | Original, Kalamansi, Merienda, Mono, Dusk, Kape, Ube, Sampaguita, Gabi, Luma and Ulan preview on the actual photo in real time (D-64); no beauty or face-retouch filters ever | P0 | Capture |
| FR-CAP-05 | Stickers | Add, move, pinch to resize, two-finger rotate and delete stickers; slot suggestions first | P0 | Stickers tool |
| FR-CAP-06 | Speech bubbles | Speech, Thought, Shout and Whisper shapes; 6 colors; editable text up to 60 characters | P0 | Bubble tool |
| FR-CAP-07 | Text | Clean, Bold, Type and Serif fonts; 6 colors; size slider; left or center alignment; up to 80 characters | P0 | Text tool |
| FR-CAP-08 | Edits stored as data | Stickers, bubbles, text and filter are saved as data with position, scale and rotation, not burned into the photo; reopening the editor restores them | P0 | Editor |
| FR-CAP-09 | Caption and visibility | Caption up to 150 characters; a Readers, Everyone or Only me choice for the moment, starting at the user’s default visibility (D-48); Undo; Done or Add to #slot saves | P0 | Capture |
| FR-CAP-10 | Moment options | Edit caption, edit stickers and filters, re-crop, change visibility (Readers, Everyone, Only me; D-48), move to another empty slot in the same jar, set as the jar's cover (an uploaded live moment; D-56, D-75), delete (with confirmation) | P0 | Moment options |
| FR-CAP-11 | Camera permission off | Shows Camera access off with Open Settings and Choose from gallery instead | P0 | Camera access off |

## Publishing and visibility

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-PUB-01 | Publish review | Shows all 8 slots (empty dashed; each moment with its visibility badge: readers, globe or lock) and a visibility choice for the jar; default is the user’s default visibility (Readers unless changed). Publishing never changes a moment’s visibility (D-50). Opened from Today for today’s open jar, or from a past day’s page for that day’s jar while it isn’t published (D-55). Publishing plays a success haptic, and the page it returns to plays a short confetti burst and closes the jar card's lid once (D-58, D-77) | P0 | Publish review |
| FR-PUB-02 | Jars hidden until published | Nobody but the owner can see a jar before Publish jar; moments follow their own visibility (Readers, Everyone or Only me, default from the profile), published jar or not (D-48); a published jar shows each viewer only the moments they may see (D-50); verified by database tests as owner, reader, outsider and blocked user | P0 | All |
| FR-PUB-03 | Visibility levels | Readers: only users who read the author. Everyone: any signed-in user and the shared-link page. Only me: owner only. Changeable after publishing from the jar’s menu | P0 | Publish review, Jar |
| FR-PUB-04 | Auto-share after publishing | Today shows the Published state and note; moments added later the same day join the published jar. Who sees a moment is its own visibility, not publishing (D-48), so this no longer shares moments by itself | P0 | Today, published |
| FR-PUB-05 | Only me moments | An Only me moment is never visible to anyone but the owner, in any jar, feed, card or web page, and can’t be shared (D-48). Moments that were private, or in a jar that wasn’t published, became Only me (D-49) | P0 | All |
| FR-PUB-06 | Blocks hide everything | If either user blocked the other, neither sees the other’s jars, moments, comments, profile or search result | P0 | All |
| FR-PUB-07 | Safety hold | Moments in Checking or Removed status are visible only to the owner (Removed shows the notice) | P0 | Checking photo, Moment removed |

## Jars feed, social and profiles

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-SOC-01 | Jars and Moments feeds | Jars: published jars from authors the user reads and the user’s own published jars (D-53), newest update first; 20 per page with infinite scroll; pull to refresh; avatar row marks authors with new jars since last visit; a card's mosaic shows the jar's cover large (D-56, D-75), then slot order. Moments (D-52, D-53): live moments the user may see (D-48) from authors they read, plus all their own live moments, newest added first; 20 per page with infinite scroll; pull to refresh; each card shows author, slot hashtag, time, the edited 3:4 photo, caption, like and comment count; the user’s Only me moments carry a lock; tapping a card opens Moment detail, even when the jar isn’t published (D-67), and its comment button opens that moment’s own thread (D-69) | P0 | Jars, Moments |
| FR-SOC-02 | Empty feed | With no authors, the user’s own published jars (Jars) or own live moments (Moments) sit under a Find people card (D-53); the empty view with Find people, Invite friends and suggestions shows only when there is nothing at all; reading people with nothing yet shows a short empty state with Find more people; every empty list shows an illustration, a title, one line and an action where one exists, and the pull-to-refresh lists add “Pull down to refresh” (D-87) | P0 | Jars, empty; Moments |
| FR-SOC-03 | Jar page | Cover, author, date, count, Full jar tag at 8/8; grid of visible moments with Added later badges; like, comment and Share jar. The cover is the owner's pick (D-56) when the viewer may see it, else the newest caption, else the first slot, among the moments that viewer sees (D-75) | P0 | Jar |
| FR-SOC-04 | Moment detail | Full-screen 3:4 moment with one progress bar per shown moment, the current one highlighted (none for a single moment); swipe left and right through the jar's shown moments; hashtag, time, caption, likes, and the moment's own comment count; the comment button opens the moment's thread (D-51) | P0 | Moment detail |
| FR-SOC-05 | Likes | One like per user per jar or moment; tapping again removes it; counts update immediately and are public. Liking pops the heart with a light haptic (D-58) | P0 | Jar, Moment detail |
| FR-SOC-06 | Comments | Each jar and each moment has its own thread (D-51); existing comments stay on the jar thread; the jar's count covers only the jar thread, a moment's count only its own; a moment thread is open to whoever can see the moment, a jar thread to whoever can see the jar (D-69); up to 300 characters; one level of replies, in the parent's thread; author or jar owner can delete; text passes the safety check before others see it; a comment on your moment notifies you as "commented on your moment" and opens the moment's thread | P0 | Comments, Moment detail |
| FR-SOC-07 | Follow (read) | Be a reader (D-86) and Read back follow an author; Reading unfollows; owner can remove a reader; counts update on both profiles | P0 | Profiles, Readers & authors |
| FR-SOC-08 | Profiles | Cover, avatar, name, @username, bio (up to 120 characters), Readers · Authors · Jars counts, Jars and Moments tabs; “Reads you” tag on other profiles | P0 | My profile, Other profile |
| FR-SOC-09 | Readers and authors lists | Switch between the two lists; search by name or username; Reading / Read back buttons | P0 | Readers & authors |
| FR-SOC-10 | Share jar card | 9:16 image with author, date, the shown moments in a layout the user picks (layouts follow the moment count, first one by default; D-62), optional last caption, Pickld logo and pickld.me/username; Save image, Copy link, Message, Share to…; private moments never included; the jar's cover goes first, an Only me cover falls back to the rule over the card's moments (D-56, D-75); photos keep their 3:4 shape, as large as the card allows less a thin margin (D-89), names and captions on pills clear of the Story's covered bands (D-82); only the owner can share their jar or moment (D-83) | P0 | Share jar card |
| FR-SOC-11 | Edit profile | Change cover, avatar, name, username (availability check), bio with counter, jar lid. A new avatar is framed on Crop as a square under a circle guide, a new cover at 5:2 (pan and zoom; Cancel changes nothing) (D-79) | P0 | Edit profile, Crop |

## My days, memories, explore and notifications

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-DAY-01 | Calendar of jars | Month view; past days show the jar’s cover photo and a fill bar for its count; today outlined; future days disabled; previous months reachable back to the first jar | P0 | My days |
| FR-DAY-02 | Fill in a past day | Selecting a past day shows its moments, missing slots and Fill this jar. Fill this jar opens that day’s page (D-55): Today’s jar card and 8 tiles for that date, without a Now tile; an empty tile opens the camera for that day and slot, and capturing there adds to that jar with Added later; a filled tile opens the moment preview for that day (D-74); Publish reviews that day’s jar while it isn’t published | P0 | My days, Day |
| FR-DAY-03 | Memories | “On this day” card from the same date in earlier years, monthly recap (moments, full jars, top hashtag, photo strip), year summary | P1 | Memories |
| FR-EXP-01 | Search people | Search by name or @username, results within 1 second; blocked users never appear | P1 | Explore |
| FR-EXP-02 | Suggestions | Suggested authors from contacts and friends of friends; Full jars today from Everyone jars | P1 | Explore |
| FR-NOT-01 | Slot reminders | Local notifications at each enabled slot time; cancelled for today once that slot is filled; rescheduled on app open, settings change and time zone change; copy rotates and never mentions streaks | P0 | Notification designs |
| FR-NOT-02 | Social push | Push for new reader, comment and reply, batched likes, moment removed or appeal decided, friend joined (at most one a day) | P0 | Notification designs |
| FR-NOT-03 | Notifications screen | Pinned reminder card while the current slot is empty; Today and This week groups; tapping opens the related screen; unread dot on the bell | P0 | Notifications |
| FR-NOT-04 | Controls and quiet hours | Each push type can be turned off; server pushes respect quiet hours 10 PM–7 AM local by default | P0 | Settings |

## Stickers

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-STK-01 | Free packs at launch | Everyday, The Eight, Stamps (auto time, date, jar number) and Milestones available to all; about 50 stickers total | P0 | Stickers tool |
| FR-STK-02 | Server-driven catalog | New packs and stickers appear without an app update; sticker art cached on the phone after first use | P0 | Stickers tool |
| FR-STK-03 | Suggestions | The current slot’s suggested stickers appear first, tuned by onboarding answers | P0 | Stickers tool |
| FR-STK-04 | Viewers never pay | Anyone who can see a moment sees all its stickers, whether or not they own the pack | P0 | All |
| FR-STK-05 | Earned stickers | Milestone stickers unlock automatically (first full jar, 7 full jars, 30 jars, 100 jars, 1 year) with the Sticker unlocked screen | P0 | Sticker unlocked |
| FR-STK-06 | Sticker shop | Seasonal banner, For you row, owned and earned packs; locked packs show a lock in the editor. Shown as Shop on the Stickers page (`/stickers?tab=shop`, D-61), opened from a stickers button in Today’s header, a Stickers row on your own profile and the editor’s shop banner; `/stickers/shop` redirects there | P1 | Sticker shop, Stickers home |
| FR-STK-07 | Buy a pack | Pack preview with a cover of the pack’s own stickers, large (no photo, D-81); store purchase; pack unlocks within 5 seconds of a verified receipt; seasonal packs stay owned after their season | P1 | Pack preview |
| FR-STK-08 | My stickers | Reorder packs, hide packs, Restore purchases. Shown as Mine, the default tab of the Stickers page (`/stickers`, D-61), also opened from Settings → My stickers; `/stickers/mine` redirects there | P1 | My stickers, Stickers home |

## Settings, privacy and safety

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-SET-01 | Settings | Account card with Edit; reminder times with on/off per slot; default visibility; blocked accounts; My stickers; help; terms and privacy; sign out | P0 | Settings |
| FR-SET-02 | Help and feedback | Searchable common questions; Contact support and Send feedback open an email or form with the app version attached | P0 | Help & feedback |
| FR-SAF-01 | Report | Report a jar, moment, comment or profile with one of 7 reasons; reporter stays anonymous; Report sent offers Also block | P0 | Report, Report sent |
| FR-SAF-02 | Block and unblock | Block confirmation; blocking removes follows both ways; Blocked accounts lists them with Unblock; neither side is notified | P0 | Block, Blocked accounts |
| FR-SAF-03 | Automatic photo checks | Every photo is CSAM-scanned and moderation-scored before others see it; Checking photo shown to the owner meanwhile; most photos go live within 10 seconds | P0 | Checking photo |
| FR-SAF-04 | Child-safety match | A match blocks the photo, suspends the account and starts the legal reporting flow; it never appears in the moderation queue | P0 | — |
| FR-SAF-05 | Removal and appeal | Removed moments show the reason and Request a review; one appeal per removal; decided by a different moderator; user notified | P0 | Moment removed |
| FR-SAF-06 | Three-strike suspension | Three removals in 90 days suspends the account for 7 days with an explanation screen | P0 | — |
| FR-PRV-01 | No location data | GPS and other location EXIF stripped before upload; verified by inspecting uploaded files | P0 | — |
| FR-PRV-02 | Data export | Delete account offers a zip of all photos and captions, delivered by link within 24 hours | P0 | Delete account |
| FR-PRV-03 | Delete account | Requires typing DELETE; profile hidden immediately; all personal data and photos deleted within 30 days | P0 | Delete account |
| FR-PRV-04 | Legal pages | Terms, Privacy Policy and Community Guidelines reachable from Sign up, Settings and Help | P0 | Sign up, Settings, Help |

## Moderation console, shared-link page and widgets

| ID | Requirement | Acceptance criteria | P | Screens |
| --- | --- | --- | --- | --- |
| FR-MOD-01 | Moderator access | Only accounts with the moderator role can sign in to mod.pickld.me; all others see an access-denied page | P0 | Moderation console |
| FR-MOD-02 | Review queue | Oldest first; filters for Auto-check, Reports, Appeals and Escalated; header shows pending count, median wait and open appeals | P0 | Moderation console |
| FR-MOD-03 | Blurred by default | Every photo is blurred until the moderator presses Show photo | P0 | Moderation console |
| FR-MOD-04 | Decisions | Keep (K), Remove (R), Remove and warn, Escalate (E); the owner’s moment and notification update within a minute | P0 | Moderation console |
| FR-MOD-05 | Audit log | Every moderator action recorded with who, what, when and reason; cannot be edited or deleted | P0 | Moderation console |
| FR-WEB-01 | Shared-link page | pickld.me/username and jar links show Everyone jars and public profiles, with only their Everyone moments (D-50), the jar's cover first when it is an Everyone moment (D-56, D-75); Readers-only jars show a teaser; Only me moments never shown | P0 | Shared link web page |
| FR-WEB-02 | Link previews | Shared links show a preview image of the jar card in Messenger, Facebook, X and iMessage | P0 | Shared link web page |
| FR-WEB-03 | Open in app | With the app installed, links open the matching screen; otherwise the page shows App Store and Google Play buttons | P0 | Shared link web page |
| FR-WID-01 | Home screen widgets | Medium widget: today’s jar and capture button. Small widget: a friend’s latest moment. Update at least every 30 minutes and after each capture | P1 | Home screen widgets |

## Non-functional requirements

| ID | Requirement | Acceptance criteria | P |
| --- | --- | --- | --- |
| NFR-PERF-01 | Fast launch | Today usable within 2 seconds of a warm start and 4 seconds of a cold start on a mid-range Android phone | P0 |
| NFR-PERF-02 | Smooth scrolling | Jars feed and My days scroll at 60 fps on mid-range phones; images load progressively from thumbnails | P0 |
| NFR-OFF-01 | Offline capture | With no connection, capture, crop, edit and save all work; moments show Waiting for connection and upload automatically when back online | P0 |
| NFR-OFF-02 | No lost photos | A queued moment survives app restarts and gallery deletion; after 5 failed attempts the tile shows Didn’t upload with Retry | P0 |
| NFR-OFF-03 | Cached reading | The last loaded feed, today’s jar and the current month of My days are readable offline | P0 |
| NFR-A11Y-01 | Screen readers | Every control has an accessible label; moments read as “#slot, time, state”; jar reads as “n of 8 moments” | P0 |
| NFR-A11Y-02 | Text size and motion | Layouts work at 200% system text size; Reduce Motion disables confetti and jar animation; tile, heart and lid pops fade in place instead, and haptics stay (D-77) | P0 |
| NFR-A11Y-03 | Touch targets | Every tap area at least 44 × 44 points (visually smaller controls use extended hit areas) | P0 |
| NFR-A11Y-04 | Contrast | Text meets WCAG AA (4.5:1), except the brand’s white text on #7fad33 primary buttons, kept by decision | P0 |
| NFR-SEC-01 | Server-side rules | All visibility and ownership rules enforced in the database; automated tests try every rule as an outsider, a reader and a blocked user | P0 |
| NFR-SEC-02 | Secrets | No service keys in the app or web pages; photo links signed and short-lived for non-public photos | P0 |
| NFR-REL-01 | Monitoring | Crashes and server errors reported to Sentry; alerts when the moderation queue is older than 2 hours or upload failures exceed 2% | P0 |
| NFR-REL-02 | Backups | Daily database backups with a tested restore before launch | P0 |
| NFR-I18N-01 | Languages | English at launch; all text in translation files so Filipino can be added without code changes; dates and times follow the phone’s locale | P0 |
| NFR-ANL-01 | Analytics events | Track sign-up step completion, first moment, moments per active day, full jars, publish, share card export, follows, report, notification opt-in; no photos or captions sent | P0 |
