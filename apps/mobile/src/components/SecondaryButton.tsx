import { sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

export type SecondaryButtonProps = ButtonProps & {
  /**
   * `subtle` (grey fill, e.g. Cancel), `outline` (white with a border, e.g. Continue with Apple) or
   * `onDark` (translucent white with white text, on the camera's black background).
   */
  variant?: 'subtle' | 'outline' | 'onDark';
};

/** Full-width secondary action. */
export function SecondaryButton({ variant = 'subtle', ...props }: SecondaryButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: variant === 'subtle' ? 'subtle' : variant === 'onDark' ? 'onDarkButton' : 'surface',
        border: variant === 'outline' ? 'border' : undefined,
        text: variant === 'onDark' ? 'surface' : 'ink',
        height: sizes.buttonSecondary,
        textVariant: 'body',
        textWeight: '700',
        paddingHorizontal: space.xxl,
        stretch: true,
      }}
    />
  );
}
