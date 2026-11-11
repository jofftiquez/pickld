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
  onDarkMuted: '#c9cec2',
  photoPlaceholder: '#d9dcd3', // behind a photo while it loads (moment tiles)
  tileIconWell: '#f0f3ea', // slot icon and + circle on empty tiles (Main)
  photoFade: 'rgba(10,12,8,0.72)', // bottom fade under labels on photos
  photoFadeClear: 'rgba(10,12,8,0)', // top end of that fade
  failedOverlay: 'rgba(160,29,20,0.55)', // "Didn't upload" tile (UploadStates)
  badge: 'rgba(10,12,8,0.6)', // "Added later" badge over photos (Story)
  ringTrack: 'rgba(255,255,255,0.3)', // unfilled part of the upload ring
  textShadow: 'rgba(0,0,0,0.4)', // labels drawn straight on photos
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
  cardTitle: { size: 17, weight: '700' },
  body: { size: 15, weight: '500' },
  bodyMedium: { size: 14, weight: '500' }, // chips (700), list row values
  bodySmall: { size: 13, weight: '500' },
  label: { size: 12, weight: '600' },
  caption: { size: 11, weight: '700' },
  button: { size: 16, weight: '800' }, // primary and danger button labels (Welcome, Publish, Delete)
} as const;

export const radius = {
  thumb: 10,
  thumbLg: 14,
  input: 16, // text fields (EditProfile)
  tile: 22,
  card: 24,
  dialog: 28, // centered confirm dialogs (Block)
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
  avatarRing: 3, // white ring on profile headers
  handleWidth: 40,
  handleHeight: 5,
  dialogButton: 48, // Cancel under a dialog's main action
  tabBar: 68,
  momentTile: 116, // Today grid tile height (2 columns)
  momentTileFade: 64, // bottom fade on a moment tile
  tileIconWell: 40, // slot icon square on empty and Now tiles
  tilePlus: 28, // + circle on empty tiles
  uploadRing: 34, // progress ring on an uploading tile
  tileBorder: 1.5, // dashed border on empty tiles
  lockBadge: 22, // round lock badge on private tiles
  pillPaddingY: 3, // time pill, Now chip and badges over photos
  retryPill: 26, // Retry pill on a failed tile (hitSlop brings it to 44)
  jarCardGraphic: 52,
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
} as const;
