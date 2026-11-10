import { sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

export type SecondaryButtonProps = ButtonProps & {
  /** `subtle` (grey fill, e.g. Cancel) or `outline` (white with a border, e.g. Continue with Apple). */
  variant?: 'subtle' | 'outline';
};

/** Full-width secondary action. */
export function SecondaryButton({ variant = 'subtle', ...props }: SecondaryButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: variant === 'subtle' ? 'subtle' : 'surface',
        border: variant === 'outline' ? 'border' : undefined,
        text: 'ink',
        height: sizes.buttonSecondary,
        textVariant: 'body',
        textWeight: '700',
        paddingHorizontal: space.xxl,
        stretch: true,
      }}
    />
  );
}
