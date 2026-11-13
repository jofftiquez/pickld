import { colors, radius } from '@/theme/tokens';

/** Text field and primary button, shared by the console's forms. */
export const input = {
  font: 'inherit',
  fontSize: 15,
  padding: '12px 14px',
  borderRadius: radius.input,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.ink,
} as const;

export const primaryButton = {
  fontSize: 16,
  fontWeight: 800,
  padding: '12px 20px',
  borderRadius: radius.pill,
  border: 'none',
  background: colors.brand,
  color: colors.surface,
} as const;

export const secondaryButton = {
  ...primaryButton,
  fontSize: 14,
  background: colors.subtle,
  color: colors.ink,
} as const;
