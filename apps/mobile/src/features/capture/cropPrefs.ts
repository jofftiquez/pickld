// Crop's last Fit style (D-152, D-154): the frame style, border and corners, kept on this phone only in the local
// key-value store, so the next photo fitted starts on the look chosen last time. Fill stays the default for every
// photo, and each photo starts whole and centred; only the look is remembered.
import Storage from 'expo-sqlite/kv-store';

import {
  DEFAULT_FIT_LAYOUT,
  fitBorderColorNames,
  fitBorders,
  fitCorners,
  fitFrames,
  type FitStyle,
} from '@/lib/image/crop';

const KEYS = {
  frame: 'crop:fitFrame',
  border: 'crop:fitBorder',
  borderColor: 'crop:fitBorderColor',
  corners: 'crop:fitCorners',
} as const satisfies Record<keyof FitStyle, string>;

export const DEFAULT_FIT_STYLE: FitStyle = {
  frame: 'white',
  border: DEFAULT_FIT_LAYOUT.border,
  borderColor: DEFAULT_FIT_LAYOUT.borderColor,
  corners: DEFAULT_FIT_LAYOUT.corners,
};

async function read<T extends string>(key: string, options: readonly T[], fallback: T): Promise<T> {
  try {
    const value = await Storage.getItem(key);
    return options.find((option) => option === value) ?? fallback;
  } catch {
    return fallback;
  }
}

/** The look chosen last time; each part at its default when none was, or the stored value can't be read. */
export async function getFitStyle(): Promise<FitStyle> {
  const [frame, border, borderColor, corners] = await Promise.all([
    read(KEYS.frame, fitFrames, DEFAULT_FIT_STYLE.frame),
    read(KEYS.border, fitBorders, DEFAULT_FIT_STYLE.border),
    read(KEYS.borderColor, fitBorderColorNames, DEFAULT_FIT_STYLE.borderColor),
    read(KEYS.corners, fitCorners, DEFAULT_FIT_STYLE.corners),
  ]);
  return { frame, border, borderColor, corners };
}

/** Remembers the parts of the look in `patch`; a store that fails only forgets them. */
export async function setFitStyle(patch: Partial<FitStyle>): Promise<void> {
  try {
    for (const [key, value] of Object.entries(patch) as [keyof FitStyle, string][]) {
      await Storage.setItem(KEYS[key], value);
    }
  } catch {
    // The choice still applies to this photo.
  }
}
