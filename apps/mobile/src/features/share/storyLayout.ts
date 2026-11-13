// Share to Stories (T-509; FR-SOC-10): what the shared image looks like. Sizes are in pixels of the
// exported image (1080 wide); the view multiplies them by `unit` so the same picture is drawn at any size.
import type { JarMoment } from '@/features/jar/jarPage';
import { colors, lidColors } from '@/theme/tokens';

import { onCard } from './shareCard';

export const storyFormats = ['story', 'feed'] as const;
export type StoryFormat = (typeof storyFormats)[number];

/** Blurred photo is the default; the order is the order of the swatches. */
export const storyBackgrounds = ['blur', 'lid', 'paper', 'ink', 'print'] as const;
export type StoryBackground = (typeof storyBackgrounds)[number];

/** Width of every exported image, in pixels (Instagram's Story and feed width). */
export const EXPORT_WIDTH = 1080;

export function canvasSize(format: StoryFormat): { width: number; height: number } {
  // Story 9:16 (1080×1920), feed post 4:5 (1080×1350).
  return { width: EXPORT_WIDTH, height: format === 'story' ? 1920 : 1350 };
}

/**
 * Space kept clear of names and captions. On a Story, Instagram and Facebook draw the profile bar over
 * the top ~13% and the reply bar over the bottom ~18%; a feed post only needs a margin.
 */
export function safeInsets(format: StoryFormat): { top: number; bottom: number; side: number } {
  return format === 'story' ? { top: 250, bottom: 340, side: 72 } : { top: 72, bottom: 72, side: 72 };
}

/** Points per exported pixel: draws the image at 1080 pixels wide on a screen with this pixel ratio. */
export function exportUnit(pixelRatio: number): number {
  return 1 / pixelRatio;
}

export type StoryPalette = {
  /** Solid fill behind everything (under the blurred photo for `blur` and `print`). */
  fill: string;
  /** A blurred copy of the photo fills the background. */
  blurred: boolean;
  /** Darkens the blurred photo so white text reads on it. */
  scrim: string | null;
  /** A paper card holds the content (`print`). */
  card: string | null;
  text: string;
  /** Wordmark tint; null keeps its own brand green (on light paper). */
  logoTint: string | null;
};

/** The profile's lid color, or the default lid when it isn't one of the lid colors. */
export function lidOf(value: string | null | undefined): string {
  const lids: readonly string[] = Object.values(lidColors);
  const lower = value?.toLowerCase() ?? '';
  return lids.includes(lower) ? lower : lidColors.pickle;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Ink or white, whichever has more contrast on a solid hex color. */
export function readableOn(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(colors.ink) + 0.05);
  return onInk >= onWhite ? colors.ink : colors.surface;
}

export function paletteFor(background: StoryBackground, lidColor: string | null | undefined): StoryPalette {
  switch (background) {
    case 'blur':
      return {
        fill: colors.camera,
        blurred: true,
        scrim: colors.glass,
        card: null,
        text: colors.surface,
        logoTint: colors.surface,
      };
    case 'lid': {
      const lid = lidOf(lidColor);
      const text = readableOn(lid);
      return { fill: lid, blurred: false, scrim: null, card: null, text, logoTint: text };
    }
    case 'paper':
      return { fill: colors.background, blurred: false, scrim: null, card: null, text: colors.ink, logoTint: null };
    case 'ink':
      return {
        fill: colors.ink,
        blurred: false,
        scrim: null,
        card: null,
        text: colors.surface,
        logoTint: colors.surface,
      };
    case 'print':
      return {
        fill: colors.camera,
        blurred: true,
        scrim: colors.glass,
        card: colors.surface,
        text: colors.ink,
        logoTint: null,
      };
  }
}

/** The moment to share on its own, or null when it can't leave its owner (private, checking or removed). */
export function shareableMoment(moments: readonly JarMoment[], id: string | undefined): JarMoment | null {
  const moment = moments.find((m) => m.id === id);
  return moment && onCard(moment) ? moment : null;
}
