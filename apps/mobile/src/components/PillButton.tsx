import { sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

export type PillButtonProps = ButtonProps & {
  /** `primary` for the main action in a row (Read, Read back, Allow); `subtle` otherwise (Reading, Copy);
   * `onDark` on the dark jar card (the Published chip, TodayPublished). */
  variant?: 'primary' | 'subtle' | 'onDark';
};

/** Compact 36 px pill that hugs its label; its tap area is extended to 44 px. */
export function PillButton({ variant = 'primary', ...props }: PillButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: variant === 'primary' ? 'brand' : variant === 'onDark' ? 'onDarkControl' : 'subtle',
        text: variant === 'subtle' ? 'ink' : 'surface',
        height: sizes.pillButton,
        textVariant: 'bodySmall',
        textWeight: '700',
        paddingHorizontal: space.md,
        stretch: false,
        icon: { size: 14, strokeWidth: 2.6 },
      }}
    />
  );
}
