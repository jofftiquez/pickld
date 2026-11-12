import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

const PRESSED_OPACITY = 0.85;
const DISABLED_OPACITY = 0.5;

export type ProviderButtonProps = {
  provider: 'apple' | 'google';
  label: string;
  onPress: () => void;
  /** Shows the brand mark before the label (Sign up has them, Sign in doesn't). */
  showMark: boolean;
  disabled?: boolean;
  testID?: string;
};

/** Continue with Apple (black) or Google (white, outlined) on Sign up and Sign in. */
export function ProviderButton({ provider, label, onPress, showMark, disabled = false, testID }: ProviderButtonProps) {
  const [pressed, setPressed] = useState(false);
  const apple = provider === 'apple';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, sizes.buttonPrimary)}
      testID={testID}
      style={[
        styles.base,
        apple ? styles.apple : styles.google,
        pressed && !disabled ? { opacity: PRESSED_OPACITY } : null,
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      {showMark ? apple ? <AppleMark /> : <GoogleMark /> : null}
      <Text style={[textStyle('button'), { color: apple ? colors.surface : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function AppleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false} importantForAccessibility="no-hide-descendants">
      <Path
        fill={colors.surface}
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.15-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75s1.79.75 3.01.72c1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.71zM14.08 5.85c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.03.08 2.07-.52 2.71-1.29z"
      />
    </Svg>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessible={false} importantForAccessibility="no-hide-descendants">
      <Path
        fill={colors.googleRed}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill={colors.googleBlue}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill={colors.googleYellow}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill={colors.googleGreen}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.buttonPrimary,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.xxl,
    alignSelf: 'stretch',
  },
  apple: { backgroundColor: colors.ink },
  google: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
});
