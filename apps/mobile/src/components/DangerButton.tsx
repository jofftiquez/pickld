import { sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

/** Full-width destructive action (Block, Delete my account, Sign out confirm). */
export function DangerButton(props: ButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: 'danger',
        text: 'surface',
        height: sizes.buttonPrimary,
        textVariant: 'button',
        paddingHorizontal: space.xxl,
        stretch: true,
      }}
    />
  );
}
