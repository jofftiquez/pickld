import { sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

export type SecondaryButtonProps = ButtonProps & {
  /**
   * `subtle` (grey fill, e.g. Cancel), `outline` (white with a border, e.g. Continue with Apple),
   * `outlineDanger` (the same with red text, e.g. Also block on Report sent) or `onDark` (translucent white
   * with white text, on the camera's black background).
   */
  variant?: 'subtle' | 'outline' | 'outlineDanger' | 'onDark';
};

/** Full-width secondary action. */
export function SecondaryButton({ variant = 'subtle', ...props }: SecondaryButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: variant === 'subtle' ? 'subtle' : variant === 'onDark' ? 'onDarkButton' : 'surface',
        border: variant === 'outline' || variant === 'outlineDanger' ? 'border' : undefined,
        text: variant === 'onDark' ? 'surface' : variant === 'outlineDanger' ? 'danger' : 'ink',
        height: sizes.buttonSecondary,
        textVariant: 'body',
        textWeight: '700',
        paddingHorizontal: space.xxl,
        stretch: true,
      }}
    />
  );
}
