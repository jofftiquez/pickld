import { shadow } from '@/theme/tokens';

type ShadowToken = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { height: number };
};

/** A shadow token as CSS. */
const css = (s: ShadowToken) =>
  `0 ${s.shadowOffset.height}px ${s.shadowRadius}px color-mix(in srgb, ${s.shadowColor} ${s.shadowOpacity * 100}%, transparent)`;

export const cardShadow = css(shadow.card);
/** Under the big green buttons (WebInvite). */
export const brandGlow = css(shadow.brandGlow);
