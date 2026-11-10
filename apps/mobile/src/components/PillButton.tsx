import { sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

export type PillButtonProps = ButtonProps & {
  /** `primary` for the main action in a row (Read, Read back, Allow); `subtle` otherwise (Reading, Copy). */
  variant?: 'primary' | 'subtle';
};

/** Compact 36 px pill that hugs its label; its tap area is extended to 44 px. */
export function PillButton({ variant = 'primary', ...props }: PillButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: variant === 'primary' ? 'brand' : 'subtle',
        text: variant === 'primary' ? 'surface' : 'ink',
        height: sizes.pillButton,
        textVariant: 'bodySmall',
        textWeight: '700',
        paddingHorizontal: space.md,
        stretch: false,
      }}
    />
  );
}
