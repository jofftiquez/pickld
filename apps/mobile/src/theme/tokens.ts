// Pickld 2.0 design tokens — source: Hi-fi A screens on the design canvas.
// Use these everywhere (NativeWind theme + Skia). Never hard-code colors, radii or font sizes.

export const colors = {
  brand: '#7fad33', // primary buttons (white text, by decision), jar lid & layers, Now chip
  brandLayer: '#94c04a', // alternating jar layer
  brandTint: '#e6f1d3', // count pills, active tab pill, success icons
  brandText: '#2c470a', // green text on light backgrounds
  brandLink: '#3f6510', // links
  ink: '#11140d', // body text, dark cards, selected tool tab
  inkSoft: '#3c4336', // long-form body copy
  muted: '#565e50', // secondary text
  background: '#f4f5f0', // app background
  surface: '#ffffff', // cards, sheets, tab bar
  subtle: '#f0f2ec', // secondary buttons, chips, segmented controls on white sheets
  segmentTrack: '#e9ece4', // segmented control track on the app background (Profile, Readers)
  border: '#dfe2d8', // inputs
  dashed: '#c9cfc0', // empty slots
  divider: '#eef0ea',
  toggleOff: '#d5d9cf', // switch track when off (Settings)
  handle: '#d5d9cf', // bottom sheet grab handle
  chevron: '#8b9184', // row chevrons (Settings); icon only, 3.3:1 on white meets the 3:1 non-text minimum
  danger: '#b42318',
  dangerTint: '#fdeceb',
  // Google's four-color G on Continue with Google (Sign up); brand mark colors, used nowhere else.
  googleBlue: '#4285f4',
  googleGreen: '#34a853',
  googleYellow: '#fbbc05',
  googleRed: '#ea4335',
  likeText: '#a01d14',
  scrim: 'rgba(10,12,8,0.55)',
  glass: 'rgba(10,12,8,0.45)', // controls over photos (with blur)
  tabBarGlass: 'rgba(255,255,255,0.86)', // the tab bar's milky blur fill
  glassStrong: 'rgba(10,12,8,0.6)', // darkens the Blurred photo share background under white words (D-90)
  // Liquid Glass tints (iOS 26+, D-80), light enough that the glass shows; `glass` and `tabBarGlass` stay for
  // the blur fallback. Labels keep AA with their colors and the `glassGlyph` shadows.
  liquidTabBarTint: 'rgba(255,255,255,0.3)', // tab bar, moment preview action bar (light glass)
  liquidDarkTint: 'rgba(10,12,8,0.25)', // round glass buttons, editor toolbar (white icons)
  liquidDarkStrongTint: 'rgba(10,12,8,0.35)', // dark glass that carries white text (Moment detail's author pill)
  liquidShadowOnDark: 'rgba(0,0,0,0.6)', // shadow under white labels and icons on dark Liquid Glass
  liquidHaloOnLight: 'rgba(255,255,255,0.85)', // halo around ink labels and icons on light Liquid Glass
  tabBarBorder: 'rgba(17,20,13,0.05)', // 1 px ring around the floating tab bar (Main)
  onDarkMuted: '#c9cec2',
  photoPlaceholder: '#d9dcd3', // behind a photo while it loads (moment tiles)
  tileIconWell: '#f0f3ea', // slot icon and + circle on empty tiles (Main)
  photoFade: 'rgba(10,12,8,0.72)', // bottom fade under labels on photos
  photoFadeClear: 'rgba(10,12,8,0)', // top end of that fade
  failedOverlay: 'rgba(160,29,20,0.55)', // "Didn't upload" tile (UploadStates)
  badge: 'rgba(10,12,8,0.6)', // "Added later" badge over photos (Story)
  ringTrack: 'rgba(255,255,255,0.3)', // unfilled part of the upload ring
  textShadow: 'rgba(0,0,0,0.4)', // labels drawn straight on photos
  dayCellEmpty: '#eef0ea', // a past day without a cover photo (Calendar)
  dayCellScrim: 'rgba(10,12,8,0.32)', // over a day's cover photo so its number stays readable (Calendar)
  dayFuture: '#6f7568', // future day numbers (Calendar); 4.8:1 on white
  slotLabelEmpty: '#6f7568', // an empty slot's tag on Publish review; darker than the design's #7d8476 for AA
  fillTrack: 'rgba(255,255,255,0.35)', // unfilled part of a day's fill bar (Calendar)
  camera: '#000000', // Camera screen background
  cameraGrid: 'rgba(255,255,255,0.35)', // rule-of-thirds lines over the viewfinder (Camera)
  onDarkControl: 'rgba(255,255,255,0.14)', // flip button fill on the camera
  cameraPanel: '#1a1c16', // top panel of Camera access off (CameraDenied)
  onDarkWell: 'rgba(255,255,255,0.1)', // icon square on Camera access off
  onDarkButton: 'rgba(255,255,255,0.12)', // secondary button on the camera (Choose from gallery instead)
  onColorButton: 'rgba(255,255,255,0.18)', // Done on the invite QR sheet, over a moment color (InviteQR)
  editor: '#0b0d09', // editor screen background behind the photo (Capture)
  editorPhoto: '#2a2d26', // behind the photo and filter thumbnails while the photo loads (Capture)
  zoneTint: '#dbe8f3', // icon well on the Time zone banner (TimeZone)
  zoneText: '#1d3a52', // icon on that well; 10:1 on zoneTint
  overlayOutline: 'rgba(255,255,255,0.95)', // dashed outline around the selected overlay (Stickers)
  overlayPlaceholder: 'rgba(127,173,51,0.6)', // dev/test-only box drawn for overlays with no renderer yet
  textOverlayShadow: 'rgba(0,0,0,0.45)', // soft shadow under light text on photos (Text)
  textOverlayShadowOnDark: 'rgba(255,255,255,0.6)', // light glow under ink text, so it reads on dark photos
  cropScrim: 'rgba(11,13,9,0.66)', // dims the photo outside the crop frame (Crop)
  appealTint: '#efe8fb', // Appeal badge in the moderation console (ModConsole)
  appealText: '#4b2f86', // its text; 8.9:1 on appealTint
  rowSelected: '#f3f8ea', // the selected queue row (ModConsole)
  cropOutline: 'rgba(255,255,255,0.9)', // crop frame outline
  storyRingNew: '#d9e88a', // light end of the green ring around an author with a new jar (Feed); starts at brand
  storyRingSeen: '#d9dcd3', // grey ring around an author with nothing new (Feed)
  notifyDot: '#d4451f', // unread dot on the bell (Feed)
  cropGrid: 'rgba(255,255,255,0.4)', // rule-of-thirds lines inside the crop frame
  galleryHeader: 'rgba(255,255,255,0.94)', // sticky day headers over the gallery grid (Choose a photo)
  onPhotoMuted: '#e2e5dc', // date and count over a photo (Memories); 12:1 on the photo fade
  cropAction: '#e2e5dc', // Cancel and Reset on the dark header (Crop); 15:1 on editor
  cropSubtitle: '#b9beb2', // "#afternoon · from gallery" under the title (Crop); 10:1 on editor
  surfaceClear: 'rgba(255,255,255,0)', // transparent end of fades into surface (the sticker grid's bottom edge)
  progressTrack: 'rgba(255,255,255,0.4)', // moments not reached yet in Moment detail's progress bars (Moment)
  confettiGlint: '#ffffff', // light catching a Publish confetti piece as it flips (D-132); drawn at up to 50%
} as const;

// Text tool colors (Text), in the design's order. Drawn on photos with a shadow (colors.textOverlayShadow).
export const textOverlayColors = {
  white: '#ffffff',
  ink: '#11140d',
  pickle: '#7fad33',
  butter: '#ffe08a',
  blush: '#fdeceb',
  sky: '#dbe8f3',
} as const;

// Jar lid choices (onboarding + Edit profile). Layers always stay brand green.
export const lidColors = {
  pickle: '#7fad33',
  mango: '#f2b632',
  ube: '#8e6fc4',
  sunset: '#e8743b',
  sky: '#4a9ad4',
  ink: '#11140d',
} as const;

// Jar graphic glass, outline and shine (JarGraphic). Layers use brand / brandLayer.
export const jar = {
  glass: 'rgba(17,20,13,0.04)',
  glassOnDark: 'rgba(255,255,255,0.08)',
  strokeOnDark: 'rgba(255,255,255,0.75)',
  highlight: 'rgba(255,255,255,0.55)',
} as const;

// Sticker colors used with white text — darkened to pass 4.5:1.
export const stickerOnWhiteText = {
  orange: '#c4521c',
  blue: '#2f74a8',
  purple: '#6f4fae',
} as const;

export const font = {
  family: 'PlusJakartaSans', // load 400, 500, 600, 700, 800 with expo-font
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' },
} as const;

// Minimum text size is 11. Sizes scale with the system text size (support up to 200%).
export const type = {
  screenTitle: { size: 32, weight: '800', letterSpacing: -0.96 }, // -0.03em
  sectionTitle: { size: 20, weight: '800', letterSpacing: -0.4 },
  noticeTitle: { size: 24, weight: '800', letterSpacing: -0.48 }, // -0.02em, "We removed one of your moments" (Removed)
  cardTitle: { size: 17, weight: '700' },
  jarCardTitle: { size: 18, weight: '700' }, // "5 of 8 moments" on the Today jar card (Main)
  body: { size: 15, weight: '500' },
  bodyMedium: { size: 14, weight: '500' }, // chips (700), list row values
  bodySmall: { size: 13, weight: '500' },
  label: { size: 12, weight: '600' },
  caption: { size: 11, weight: '700' },
  button: { size: 16, weight: '800' }, // primary and danger button labels (Welcome, Publish, Delete)
  eyebrow: { size: 12, weight: '800', letterSpacing: 0.96 }, // 0.08em, "FULL JAR", "STICKER UNLOCKED"
  celebrationTitle: { size: 26, weight: '800', letterSpacing: -0.78 }, // "Your Monday is complete" (FullJar)
  unlockTitle: { size: 28, weight: '800', letterSpacing: -0.84 }, // "Your first full jar!" (StickerUnlock)
  cropTitle: { size: 16, weight: '700' }, // "Crop photo" (Crop)
  countTile: { size: 26, weight: '800' }, // "8/8" on the tile ending the Jar page grid (Story)
  profileName: { size: 22, weight: '800', letterSpacing: -0.44 }, // name on a profile header (Profile)
  momentCaption: { size: 18, weight: '700', letterSpacing: -0.18 }, // caption in Moment detail's sheet (Moment)
  onboardTitle: { size: 30, weight: '800', letterSpacing: -0.9 }, // Welcome, How it works, Sign up (-0.03em)
} as const;

export const radius = {
  thumb: 10,
  reviewSlot: 12, // the 8 slots on Publish review (Publish)
  thumbLg: 14,
  lidChoice: 12, // jar lid colour squares (EditProfile)
  mosaicLarge: 16, // large photo in a feed jar card's mosaic (Feed); the small ones use thumbLg
  dayCell: 13, // My days calendar cells (Calendar)
  fillBar: 2,
  input: 16, // text fields (EditProfile)
  banner: 16, // offline banner on Today (UploadStates)
  zoneBanner: 18, // Time zone banner on Today (TimeZone)
  zoneIcon: 13, // icon well on that banner
  notifyIcon: 13, // icon wells on Notifications (the reminder card, Full jar rows)
  reminderCard: 22, // pinned reminder card on Notifications
  optionIcon: 13, // icon well on a Moment options row (MomentOptions)
  permissionIcon: 16, // icon well on each Permissions card
  shareCard: 24, // the Share jar card (ShareCard)
  shareTile: 8, // photos on the card
  shareAction: 18, // action wells on Share jar
  shareLayout: 6, // layout thumbnails on Share jar (D-62)
  shareLayoutCell: 2, // the photo blocks inside a layout thumbnail
  tile: 22,
  jarTile: 18, // moments in the Jar page grid (Story)
  introTile: 18, // the eight slot tiles on Intro1
  introHero: 22, // tilted selfie on Intro3
  emptyTile: 12, // the three tilted tiles on Jars, empty (EmptyStories)
  card: 24,
  dialog: 28, // centered confirm dialogs (Block)
  celebration: 30, // Full jar card (FullJar)
  countBadge: 10, // "8/8" badge on the full jar (FullJar)
  milestoneCard: 18, // Milestones progress card (StickerUnlock)
  progressBar: 3, // its bar
  confettiStrip: 2, // ends of a confetti strip (FullJar, StickerUnlock)
  noteSheet: 28, // white sheet under the blurred photo (Checking)
  viewfinder: 28, // bottom corners of the camera viewfinder (Camera)
  cameraTag: 18, // slot tag over the viewfinder (Camera)
  editorPhoto: 32, // bottom corners of the photo in the editor (Capture)
  filterThumb: 18, // filter thumbnails (Capture)
  overlayOutline: 16, // dashed outline around the selected overlay (Stickers)
  tabBar: 26,
  sheet: 30,
  timeChip: 10, // reminder time chips (Settings)
  settingsIcon: 13, // slot icon wells on the Reminders card (Settings)
  pill: 999,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28 } as const;

export const shadow = {
  card: {
    shadowColor: '#11140d',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#11140d',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dialog: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
  tile: {
    shadowColor: '#11140d',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  nowGlow: {
    shadowColor: '#3f6510',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  overlayControl: {
    // delete circle and handle on the selected overlay (Stickers)
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  brandGlow: {
    shadowColor: '#7fad33',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

// Keeps labels (`text`) and icons (`icon`, on a transparent view around the icon) readable on the lighter
// Liquid Glass tints over bright and dark content (D-80), per surface tone. Only on glass; the blur's
// stronger tints need none, so the fallback looks as before.
export const glassGlyph = {
  dark: {
    text: {
      textShadowColor: colors.liquidShadowOnDark,
      textShadowRadius: 4,
      textShadowOffset: { width: 0, height: 1 },
    },
    icon: {
      shadowColor: colors.liquidShadowOnDark,
      shadowOpacity: 1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
  },
  light: {
    text: { textShadowColor: colors.liquidHaloOnLight, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
    icon: {
      shadowColor: colors.liquidHaloOnLight,
      shadowOpacity: 1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 0 },
    },
  },
} as const;

export const sizes = {
  selectFieldLarge: 128, // a select field's narrowest width at large text: fits "1990" (About, D-37)
  timeChip: 28, // reminder time chips (Settings); 44 pt tap area via hitSlop
  settingsIcon: 36, // slot icon wells on the Reminders card (Settings)
  minTap: 44, // every tap area, via hitSlop when the visual is smaller
  galleryGap: 2, // gap between photos in the gallery grid (Choose a photo)
  galleryDayHeader: 36, // a day's header in that grid at default text size; grows with large text
  galleryRing: 2, // brand outline around the photos of the day being filled
  buttonPrimary: 54,
  buttonSecondary: 50,
  pillButton: 36,
  textField: 50,
  searchField: 46, // search field on Readers & authors (Readers)
  textArea: 74,
  segment: 36,
  chip: 42,
  toggleWidth: 48,
  toggleHeight: 28,
  toggleThumb: 24,
  roundButton: 44,
  cardPadding: 14, // Settings cards
  avatarSm: 32, // story header, moment options
  avatarMd: 52, // Settings profile row
  avatarLg: 64, // Block dialog
  avatarXl: 88, // profile header
  avatarEdit: 80, // Edit profile, over the cover
  avatarEditBadge: 28, // green camera badge on it
  avatarHeader: 44, // Today header, next to the calendar button (Main)
  avatarRing: 3, // white ring on profile headers
  handleWidth: 40,
  handleHeight: 5,
  dialogButton: 48, // Cancel under a dialog's main action
  tabBar: 68,
  tabPillWidth: 52, // active tab highlight behind the icon (Main)
  tabPillHeight: 30,
  tabIconLabelGap: 3,
  momentTile: 116, // Today grid tile height (2 columns)
  momentTileFade: 64, // bottom fade on a moment tile
  tileIconWell: 40, // slot icon square on empty and Now tiles
  tilePlus: 28, // + circle on empty tiles
  uploadRing: 34, // progress ring on an uploading tile
  tileBorder: 1.5, // dashed border on empty tiles
  lockBadge: 22, // round visibility badge on moment tiles (lock, globe, people)
  radio: 22, // radio circle on a choice row (Publish)
  radioDot: 12, // its selected dot
  radioRing: 2, // its outline
  reviewSlotGap: 6, // gap between the 8 slots on Publish review (Publish)
  pillPaddingY: 3, // time pill, Now chip and badges over photos
  retryPill: 26, // Retry pill on a failed tile (hitSlop brings it to 44)
  jarCardGraphic: 52,
  headerTop: 26, // space above the screen title block (Main)
  dayCell: 46, // My days calendar cell height (Calendar); grows with large text
  dayGap: 5, // gap between calendar cells and weekday columns (Calendar)
  fillBar: 3, // fill bar height in a calendar cell
  fillBarInset: 4, // fill bar distance from the cell's sides and bottom
  todayRing: 2.5, // outline around today's cell
  dayCardJar: 20, // jar beside the selected day's date (Calendar)
  monthButton: 36, // My days month chooser pill that opens the month picker; hitSlop brings it to 44 (D-140)
  monthButtonIcon: 16, // its chevron
  bannerPaddingY: 10, // offline banner (UploadStates)
  bannerPaddingX: 14,
  bannerGap: 10, // offline banner: icon to text, and banner to the jar card
  emptyTileWidth: 56, // the three tilted tiles on Jars, empty (EmptyStories)
  emptyTileHeight: 75,
  emptyWell: 64, // tinted circle behind an empty list's icon (EmptyState, D-87)
  emptyWellCompact: 48, // the same in a section of a page (Explore)
  emptyJar: 64, // empty jar graphic on an empty list (EmptyState)
  storyAvatar: 58, // author ring in the Jars avatar row (Feed)
  storyRing: 2.5, // ring width around it
  storyGap: 2, // background-colored gap between the ring and the photo
  feedAvatar: 38, // author avatar on a feed jar card (Feed)
  mosaicRow: 70, // height of each small row in a feed jar card's mosaic; the large photo spans two
  mosaicGap: 6,
  notifyDot: 8, // unread dot on the bell (Feed)
  welcomeCollage: 470, // photo collage above the Welcome sheet (Welcome)
  welcomeCollageLarge: 220, // the collage at large text, so the promise and Get started come up sooner
  welcomeSheetOverlap: 24, // the sheet tucks this far over the collage
  welcomeLogo: 76, // Pickld wordmark width on the Welcome sheet
  introArt: 400, // illustration area on How it works (Intro1–3)
  introPhoto: 74, // tilted photos around the jar (Intro2)
  introJar: 120, // jar in the middle of Intro2
  introHero: 160, // tilted selfie on Intro3
  introCheck: 26, // check circle beside each promise (Intro3)
  photoFrame: 3, // white frame around tilted photos (Intro2, Sign up)
  authPhoto: 84, // fanned photos above Sign up and Sign in
  pageDot: 7, // How it works page dots
  pageDotActive: 22,
  checkEmailWell: 96, // envelope tile on Check your email (CheckEmail)
  checkEmailIcon: 40,
  codeBox: 56, // each of the six code boxes on Check your email (CheckEmail); grows with large text
  textFieldTrailing: 120, // room kept on the right of a field for its trailing note (About: ✓ Available)
  sheetMaxHeight: 520, // a scrollable sheet stops growing here and scrolls (SelectField on About)
  quizIcon: 48, // icon well on a Your day choice (QuizDay)
  quizCheck: 24, // radio / check circle on a Your day choice
  peopleIcon: 30, // icon well beside each Your people question (QuizPeople)
  permissionIcon: 46, // icon well on each Permissions card
  holdRing: 104, // progress ring around Hold to promise (Promise)
  holdButton: 82, // the green button inside it
  promiseLogo: 60, // Pickld wordmark width on Promise
  tipJar: 40, // jar beside the First moment tip title (Coach)
  shareSwatch: 44, // background swatches on Share (T-509)
  shareAction: 54, // round action wells on Share jar
  shareLayoutThumb: 52, // height of a layout thumbnail on Share jar (D-62); its width follows the format
  sharePanel: 0.4, // the Share jar panel's largest share of the screen height; past it the panel scrolls (D-62)
  lidStage: 200, // tinted circle behind the jar (JarLid)
  lidJarLarge: 124, // jar on Pick your jar
  lidSwatch: 44, // colour squares on Pick your jar
  setupStep: 5, // height of each step in the setup progress bar (About … Promise)
  under13Jar: 96, // empty jar on Under 13
  under13Top: 80, // space above the jar on Under 13
  notifyAvatar: 40, // avatar, icon well and thumbnail width on a Notifications row (Notifications)
  notifyThumbHeight: 53, // 3:4 thumbnail beside a like or comment
  notifyReminderIcon: 44, // slot icon well on the pinned reminder card
  countJar: 14, // jar icon in a feed card's "6/8" pill
  zoneIcon: 38, // icon well on the Time zone banner (TimeZone)
  shutter: 84, // camera shutter ring (Camera)
  shutterInner: 68,
  shutterRing: 4,
  cameraSideButton: 52, // gallery shortcut and flip button beside the shutter
  accessOffIconWell: 72, // camera-off icon square (CameraDenied)
  accessOffPanel: 520 / 844, // top panel's share of the screen height (CameraDenied)
  filterThumb: 58, // filter thumbnail square (Capture)
  filterRing: 2, // green ring around the selected filter thumbnail
  filterRingGap: 3, // white gap between the thumbnail and its ring
  editorPanelOverlap: 10, // the white tool panel tucks under the photo's rounded bottom (Capture)
  noteIcon: 44, // lock square beside the owner-only note (Checking)
  noticeThumb: 64, // blurred photo beside "Moment removed" (Removed)
  celebrationJar: 110, // full jar on the Full jar card (FullJar)
  unlockJar: 120, // full jar behind the earned sticker (StickerUnlock)
  unlockArt: 240, // jar, halo and sticker area (StickerUnlock); the halo is inset by space.xl
  unlockArtHeight: 260,
  unlockSticker: 150, // earned sticker's width over the jar; height follows the art
  progressBarWidth: 80, // Milestones progress bar (StickerUnlock)
  progressBarHeight: 6,
  profileCover: 150, // cover band at the top of a profile (Profile, ProfileOther)
  profileAvatarOverlap: 44, // how far the profile avatar rises into the cover
  profileButton: 40, // Edit profile pill beside the avatar (Profile)
  profileTileFade: 50, // bottom fade under a profile grid tile's date and count
  editCover: 120, // cover preview on Edit profile (EditProfile)
  editAvatarOverlap: 36, // how far its avatar rises into the cover
  changeCover: 34, // "Change cover" pill on the cover
  lidChoice: 36, // jar lid colour squares (EditProfile)
  lidRing: 2, // ink ring on the chosen one
  lidJar: 40, // jar beside them, wearing the chosen lid
  momentProgress: 3, // height of each of Moment detail's progress bars, one per shown moment (Moment)
  momentProgressCurrent: 5, // the bar of the moment on screen
  momentSheetOverlap: 24, // Moment detail's white sheet tucks this far under the photo
  momentAction: 46, // like, comment and share controls in Moment detail's sheet
  overlayOutlineInset: 8, // dashed outline sits this far outside the selected overlay (Stickers)
  overlayOutlineWidth: 1.5,
  overlayDelete: 24, // white delete circle on the outline's top-right corner (Stickers)
  overlayDeleteOffset: 14, // how far it pokes out past the overlay's top and right edges
  overlayDeleteIcon: 12,
  overlayHandle: 18, // white resize-and-rotate handle on the bottom-right corner (Stickers)
  overlayHandleOffset: 12, // how far it pokes out past the overlay's bottom and right edges
  textRowLabel: 44, // "Color" and "Size" labels in the Text panel
  textSwatch: 32, // color circles in the Text panel
  textSwatchRing: 2, // ink ring around the selected color, with a white gap of the same width
  sliderTrack: 4, // size slider track (Text)
  sliderThumb: 22,
  optionIcon: 38, // icon well on a Moment options row (MomentOptions)
  optionThumb: 42, // photo beside the slot in the Moment options header
} as const;

export const photo = {
  aspect: 3 / 4,
  full: { width: 1440, height: 1920 },
  thumb: { width: 480, height: 640 },
  quality: 0.8, // WebP
  checkingBlur: 24, // blur radius on a photo while moderation checks it
} as const;

export const slots = [
  'whereami',
  'mebusywith',
  'whoamiwith',
  'ootd',
  'selfie',
  'morning',
  'afternoon',
  'evening',
] as const;
export type Slot = (typeof slots)[number];

// "Now" tile windows, local time (24h, inclusive start, exclusive end).
export const slotWindows = {
  morning: [5, 12],
  afternoon: [12, 18],
  evening: [18, 24],
} as const;

export const filters = [
  'original',
  'kalamansi',
  'merienda',
  'mono',
  'dusk',
  'kape',
  'ube',
  'sampaguita',
  'gabi',
  'luma',
  'ulan',
] as const;

export const motion = {
  fast: 150,
  base: 250,
  jarLayerSettle: 450, // skip when Reduce Motion is on
  confettiFall: 900, // each confetti piece's drop (FullJar, StickerUnlock); no confetti with Reduce Motion
  confettiBurst: 4200, // the longest Publish confetti piece's flight, launch to faded out (D-132, D-133); none with Reduce Motion
  celebrationPop: 400, // celebration content grows in; a plain fade (base) with Reduce Motion
} as const;

// Stickers tool (design: Stickers): pack tabs, the sticker grid, and auto stamps drawn with live values.
export const stickerTool = {
  cell: '#f7f8f5', // behind each sticker in the grid
  cellRadius: 16,
  cellHeight: 50,
  cellArtHeight: 30, // word-sticker art inside a cell; contain keeps it whole
  cellPictureHeight: 40, // near-square picture stickers (T-506) get a taller box so they read at the same weight
  cellColumns: 3,
  packTabHeight: 36,
  // Unselected pack tab fills with ink text (all above 12:1); selected tabs are ink with white text.
  packTint: {
    everyday: '#e6f1d3',
    'the-eight': '#fbeccd',
    stamps: '#f0f2ec',
    milestones: '#efe8fb',
    'pinoy-life': '#fbeccd',
    barkada: '#efe8fb',
    'work-from-wherever': '#dbe8f3',
    'pet-parent': '#e6f1d3',
    'christmas-2026': '#f6dcd9',
    olivia: '#fbe3ea',
    'fish-moods': '#dbe8f3',
    corporate: '#dbe8f3',
    'gen-z': '#efe8fb',
    trentahin: '#fbeccd',
    pride: '#f6dcd9',
    cyclists: '#e6f1d3',
  } as Record<string, string>,
  packTintDefault: '#f0f2ec',
  // "New: Christmas pack · ₱49 · Shop" under the grid (FR-STK-06): ink text, "Shop" in brown (8:1 on it).
  shopBanner: '#fbeccd',
  shopBannerLink: '#6b4b10',
  shopBannerRadius: 16,
  // Auto stamp (stickers/stamps art): white label, thick ink border, dashed ink ring outside it. Sizes are
  // fractions of the stamp's height so it scales with the overlay.
  stamp: { ring: 0.025, inset: 0.07, border: 0.05, radius: 0.16, text: 0.3, padding: 0.2 },
} as const;

// Sticker shop (StickerShop, FR-STK-06): the seasonal banner (white text 7:1 on its red), pack cards with a
// tinted art well, and the price pill (white on brand, the primary-button pairing by decision).
export const stickerShop = {
  seasonal: '#a01d14',
  seasonalEyebrow: '#ffd6d2',
  seasonalText: '#ffe3e0',
  bannerHeight: 150,
  bannerRadius: 24,
  cardWidth: 150,
  cardArtHeight: 120,
  cardRadius: 18,
  bannerSampleHeight: 42, // sticker art on the seasonal banner (the PNG's height, shadow margin included)
  searchHeight: 46,
  ownedTint: '#e6f1d3', // art well behind packs the user has (Yours)
  // Pack preview (PackPreview): the tinted cover with the pack's stickers, large (D-81).
  heroRadius: 40,
  heroStageHeight: 226,
  cloudSampleHeight: 36,
} as const;

// My stickers (MyStickers, FR-STK-08): each pack row has a drag grip, a tinted tile with its first sticker
// and a switch.
export const explore = {
  searchHeight: 48, // Search people or @username (Explore)
  searchRadius: 22,
  cardWidth: 152, // a Suggested authors card
  cardGap: 10,
  gridColumns: 3, // Full jars today
  gridGap: 8,
  tileRadius: 16,
} as const;

export const memories = {
  heroHeight: 300, // On this day photo card (Memories)
  heroRadius: 26,
  heroFade: 0.55, // share of the card the bottom fade covers
  stripGap: 5, // between the recap's five photos
  stripColumns: 5,
  yearIcon: 44, // sparkle well on the year summary
  yearIconRadius: 13,
} as const;

export const myStickers = {
  tile: 52,
  tileRadius: 14,
  tileSampleHeight: 26,
  tileSampleMaxWidth: 0.9, // share of the tile a wide sample may span
} as const;

// Crop screen (Crop, FR-CAP-03): the 3:4 frame sits this far inside the dark photo area, with the 3:4 chip
// above it and the gesture hint below; the white tool sheet holds the zoom slider and tool buttons.
export const crop = {
  frameInsetX: 45, // at least this much dark photo beside the frame
  frameInsetY: 48, // dark photo above and below the frame, room for the 3:4 chip and the hint
  headerPaddingTop: 8, // under the safe area, as the editor's toolbar (D-65)
  noteHeight: 32, // two lines of the note under the tools, so the sheet fits on narrow phones
  titleGap: 1,
  sheetPaddingTop: 18,
  frameOutline: 1.5,
  corner: 24, // white corner marks on the frame
  cornerWidth: 4,
  cornerOffset: 3, // how far the marks sit outside the frame
  cornerRadius: 4,
  chipTop: 18,
  chipPaddingX: 12,
  chipPaddingY: 4,
  chipIcon: 12,
  chipGap: 5,
  hintBottom: 22,
  headerAction: 64, // Cancel minimum width
  toolButton: 64, // Rotate, Flip, Fit, Reset (grows with large text)
  toolRadius: 18,
  zoomIcon: 18,
} as const;

// Invite page (Invite, InviteQR; INV-07): one collectible card per code in its moment's color, white text on
// each (all 4.5:1 or more). `morning` is new for invites; the others repeat colors used elsewhere.
export const invite = {
  slotColors: {
    whereami: '#2f74a8',
    mebusywith: '#c4521c',
    whoamiwith: '#6f4fae',
    ootd: '#a01d14',
    selfie: '#3f6510',
    morning: '#8a5a00',
    afternoon: '#1d3a52',
    evening: '#11140d',
  },
  cardHeight: 122,
  cardRadius: 18,
  cardGap: 10,
  watermark: 118, // the big "#" in a card's corner
  watermarkOnColor: 'rgba(255,255,255,0.12)',
  watermarkOnGrey: 'rgba(17,20,13,0.05)',
  button: 36, // eye, QR and share; hitSlop brings them to 44
  buttonFill: 'rgba(255,255,255,0.18)',
  greyCard: '#e9ece4', // locked and paused cards; their text is colors.muted (5.7:1; the design's #6f7568 is 4:1)
  avatarRing: 'rgba(255,255,255,0.8)', // around a friend's photo on an Invited card
  cardShadow: {
    shadowColor: '#11140d',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  codeSize: 21,
  codeSpacing: 3, // 0.14em
  linkIcon: 42,
  linkIconRadius: 13,
  // QR sheet (InviteQR): white card around the code; the QR has a quiet zone of `qrMargin` modules.
  qrCardRadius: 30,
  qrCardPadding: 22,
  qrSize: 230,
  qrMargin: 2,
  qrCodeSize: 26,
  qrCodeSpacing: 4.7, // 0.18em
} as const;

// Speech bubbles (Bubble, FR-CAP-06). Each color's text pair meets WCAG AA (4.5:1); pickle takes ink
// text, not white, because white on it is reserved for primary buttons (AGENTS rule 12).
export const bubbleColors = {
  white: { fill: '#ffffff', text: '#11140d' },
  ink: { fill: '#11140d', text: '#ffffff' },
  pickle: { fill: '#7fad33', text: '#11140d' },
  butter: { fill: '#ffe08a', text: '#11140d' },
  blush: { fill: '#fdeceb', text: '#11140d' },
  sky: { fill: '#dbe8f3', text: '#11140d' },
} as const;

// A bubble is laid out at `referenceWidth` and scaled to its overlay box, so it looks the same at any
// size (editor, tiles, share card). Its text ignores the system text size: it is part of the picture.
export const bubble = {
  referenceWidth: 200,
  fontSize: 17,
  lineHeight: 22,
  paddingX: 16,
  paddingY: 10,
  thoughtPaddingX: 24, // the pill's round ends need more room
  charWidth: 0.62, // a generous average glyph width (em) for estimating line breaks
  radius: 20, // speech: three round corners…
  tailRadius: 6, // …and a sharp bottom-left one pointing at the speaker
  shoutRadius: 4,
  shoutSkew: '-8deg',
  whisperRadius: 14,
  whisperBorder: 1.5, // dashed outline in the text color
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // Bubble panel
  styleTile: 72, // style choice height (grows with large text)
  styleTileRadius: 18,
  styleTileBorderSelected: 2,
  previewWidth: 38, // shape preview inside a style tile
  previewHeight: 24,
  previewRadius: 14,
  previewTailRadius: 4,
  previewThoughtRadius: 20,
  swatch: 32, // color circle; hitSlop brings it to 44
  swatchBorder: '#d5d9cf',
  swatchRing: 2, // white gap, then an ink ring, around the selected color
  colorLabelWidth: 44,
} as const;
