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
  likeText: '#a01d14',
  scrim: 'rgba(10,12,8,0.55)',
  glass: 'rgba(10,12,8,0.45)', // controls over photos (with blur)
  tabBarGlass: 'rgba(255,255,255,0.86)',
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
  onDarkFaint: 'rgba(255,255,255,0.55)', // unselected moment tabs on the camera (6:1 on black)
  onDarkControl: 'rgba(255,255,255,0.14)', // flip button fill on the camera
  cameraPanel: '#1a1c16', // top panel of Camera access off (CameraDenied)
  onDarkWell: 'rgba(255,255,255,0.1)', // icon square on Camera access off
  onDarkButton: 'rgba(255,255,255,0.12)', // secondary button on the camera (Choose from gallery instead)
  editor: '#0b0d09', // editor screen background behind the photo (Capture)
  editorPhoto: '#2a2d26', // behind the photo and filter thumbnails while the photo loads (Capture)
  zoneTint: '#dbe8f3', // icon well on the Time zone banner (TimeZone)
  zoneText: '#1d3a52', // icon on that well; 10:1 on zoneTint
  overlayOutline: 'rgba(255,255,255,0.95)', // dashed outline around the selected overlay (Stickers)
  overlayPlaceholder: 'rgba(127,173,51,0.6)', // dev/test-only box drawn for overlays with no renderer yet
  textOverlayShadow: 'rgba(0,0,0,0.45)', // soft shadow under light text on photos (Text)
  textOverlayShadowOnDark: 'rgba(255,255,255,0.6)', // light glow under ink text, so it reads on dark photos
  cropScrim: 'rgba(11,13,9,0.66)', // dims the photo outside the crop frame (Crop)
  cropOutline: 'rgba(255,255,255,0.9)', // crop frame outline
  storyRingNew: '#d9e88a', // light end of the green ring around an author with a new jar (Feed); starts at brand
  storyRingSeen: '#d9dcd3', // grey ring around an author with nothing new (Feed)
  notifyDot: '#d4451f', // unread dot on the bell (Feed)
  cropGrid: 'rgba(255,255,255,0.4)', // rule-of-thirds lines inside the crop frame
  cropAction: '#e2e5dc', // Cancel and Reset on the dark header (Crop); 15:1 on editor
  cropSubtitle: '#b9beb2', // "#afternoon · from gallery" under the title (Crop); 10:1 on editor
  coverFadeTop: 'rgba(10,12,8,0.35)', // top of the dark fade over the Jar page cover, behind Back (Story)
  coverFadeBottom: 'rgba(10,12,8,0.75)', // bottom of that fade, behind the author and title
  coverSubtitle: '#eef0ea', // date and count under the title on the cover (Story)
  progressTrack: 'rgba(255,255,255,0.4)', // moments not reached yet in Moment detail's 8 progress bars (Moment)
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
  momentCaption: { size: 18, weight: '700', letterSpacing: -0.18 }, // caption in Moment detail's sheet (Moment)
} as const;

export const radius = {
  thumb: 10,
  reviewSlot: 12, // the 8 slots on Publish review (Publish)
  thumbLg: 14,
  mosaicLarge: 16, // large photo in a feed jar card's mosaic (Feed); the small ones use thumbLg
  dayCell: 13, // My days calendar cells (Calendar)
  fillBar: 2,
  input: 16, // text fields (EditProfile)
  banner: 16, // offline banner on Today (UploadStates)
  zoneBanner: 18, // Time zone banner on Today (TimeZone)
  zoneIcon: 13, // icon well on that banner
  optionIcon: 13, // icon well on a Moment options row (MomentOptions)
  tile: 22,
  jarTile: 18, // moments in the Jar page grid (Story)
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

export const sizes = {
  minTap: 44, // every tap area, via hitSlop when the visual is smaller
  buttonPrimary: 54,
  buttonSecondary: 50,
  pillButton: 36,
  textField: 50,
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
  lockBadge: 22, // round lock badge on private tiles
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
  bannerPaddingY: 10, // offline banner (UploadStates)
  bannerPaddingX: 14,
  bannerGap: 10, // offline banner: icon to text, and banner to the jar card
  emptyTileWidth: 56, // the three tilted tiles on Jars, empty (EmptyStories)
  emptyTileHeight: 75,
  storyAvatar: 58, // author ring in the Jars avatar row (Feed)
  storyRing: 2.5, // ring width around it
  storyGap: 2, // background-colored gap between the ring and the photo
  feedAvatar: 38, // author avatar on a feed jar card (Feed)
  mosaicRow: 70, // height of each small row in a feed jar card's mosaic; the large photo spans two
  mosaicGap: 6,
  notifyDot: 8, // unread dot on the bell (Feed)
  countJar: 14, // jar icon in a feed card's "6/8" pill
  zoneIcon: 38, // icon well on the Time zone banner (TimeZone)
  shutter: 84, // camera shutter ring (Camera)
  shutterInner: 68,
  shutterRing: 4,
  cameraSideButton: 52, // gallery shortcut and flip button beside the shutter
  cameraTabUnderline: 2, // selected moment tab on the camera
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
  jarCover: 230, // cover photo on the Jar page (Story)
  jarTile: 112, // tile height in the Jar page's 3-column grid (Story)
  jarTileFade: 48, // bottom fade under a Jar page tile's #slot
  momentProgress: 3, // height of each of Moment detail's 8 progress bars (Moment)
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

export const filters = ['original', 'kalamansi', 'merienda', 'mono', 'dusk'] as const;

export const motion = {
  fast: 150,
  base: 250,
  jarLayerSettle: 450, // skip when Reduce Motion is on
  confettiFall: 900, // each confetti piece's drop (FullJar, StickerUnlock); no confetti with Reduce Motion
  celebrationPop: 400, // celebration content grows in; a plain fade (base) with Reduce Motion
} as const;

// Stickers tool (design: Stickers): pack tabs, the sticker grid, and auto stamps drawn with live values.
export const stickerTool = {
  cell: '#f7f8f5', // behind each sticker in the grid
  cellRadius: 16,
  cellHeight: 50,
  cellArtHeight: 30, // sticker art inside a cell; contain keeps it whole
  cellColumns: 3,
  packTabHeight: 36,
  // Unselected pack tab fills with ink text (all above 12:1); selected tabs are ink with white text.
  packTint: { everyday: '#e6f1d3', 'the-eight': '#fbeccd', stamps: '#f0f2ec', milestones: '#efe8fb' } as Record<
    string,
    string
  >,
  packTintDefault: '#f0f2ec',
  // Auto stamp (stickers/stamps art): white label, thick ink border, dashed ink ring outside it. Sizes are
  // fractions of the stamp's height so it scales with the overlay.
  stamp: { ring: 0.025, inset: 0.07, border: 0.05, radius: 0.16, text: 0.3, padding: 0.2 },
} as const;

// Crop screen (Crop, FR-CAP-03): the 3:4 frame sits this far inside the dark photo area, with the 3:4 chip
// above it and the gesture hint below; the white tool sheet holds the zoom slider and tool buttons.
export const crop = {
  frameInsetX: 45, // at least this much dark photo beside the frame
  frameInsetY: 60,
  frameShare: 400 / 844, // the frame's height is at most this share of the screen, so the sheet fits
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
  headerAction: 64, // Cancel and Reset minimum width
  toolButton: 64, // Rotate, Flip, Fit (grows with large text)
  toolRadius: 18,
  zoomIcon: 18,
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
