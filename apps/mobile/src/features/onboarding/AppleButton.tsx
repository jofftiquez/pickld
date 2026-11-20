import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

const PRESSED_OPACITY = 0.85;
const DISABLED_OPACITY = 0.5;

export type AppleButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Continue with Apple / Sign in with Apple: black, with the Apple logo before the title (Apple's guidelines). */
export function AppleButton({ label, onPress, disabled = false, testID }: AppleButtonProps) {
  const [pressed, setPressed] = useState(false);
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
        styles.button,
        pressed && !disabled ? { opacity: PRESSED_OPACITY } : null,
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Path
          fill={colors.surface}
          d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.15-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75s1.79.75 3.01.72c1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.71zM14.08 5.85c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.03.08 2.07-.52 2.71-1.29z"
        />
      </Svg>
      <Text style={[textStyle('button'), { color: colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.buttonPrimary,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.xxl,
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
  },
});
