// The first-time guide's tips (FR-ONB-10), in their own file so analytics can name them without loading storage.
export const GUIDE_TIPS = [
  'today',
  'editor',
  'details',
  'publish',
  'feed',
  'discover',
  'profile',
  'unpublished',
] as const;
export type GuideTipId = (typeof GUIDE_TIPS)[number];
