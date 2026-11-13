import { z } from 'zod';

export const stickersTabs = ['mine', 'shop'] as const;
export type StickersTab = (typeof stickersTabs)[number];

/** The Stickers page's `?tab=` (D-61): Mine unless the link asks for Shop; anything else falls back to Mine. */
export const stickersParams = z.object({ tab: z.enum(stickersTabs).catch('mine') });

export function stickersTabFrom(params: unknown): StickersTab {
  return stickersParams.parse(params ?? {}).tab;
}
