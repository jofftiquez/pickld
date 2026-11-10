import { shadow, sizes, space } from '@/theme/tokens';

import { BaseButton, type ButtonProps } from './BaseButton';

/** Full-width brand button: #7fad33 with bold white 16 px text (brand decision, AGENTS rule 12). */
export function PrimaryButton(props: ButtonProps) {
  return (
    <BaseButton
      {...props}
      tone={{
        background: 'brand',
        text: 'surface',
        height: sizes.buttonPrimary,
        textVariant: 'button',
        paddingHorizontal: space.xxl,
        shadow: shadow.brandGlow,
        stretch: true,
      }}
    />
  );
}
