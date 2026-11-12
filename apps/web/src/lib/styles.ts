import { shadow } from '@/theme/tokens';

/** The card shadow token as CSS. */
const s = shadow.card;
export const cardShadow = `0 ${s.shadowOffset.height}px ${s.shadowRadius}px color-mix(in srgb, ${s.shadowColor} ${s.shadowOpacity * 100}%, transparent)`;
