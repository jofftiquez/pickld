import { useState } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle, type FontWeight, type TextVariant } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { Icon } from './Icon';
import type { IconName } from './icons';

/** Props every text button shares. `label` is already translated. */
export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  icon?: IconName;
  testID?: string;
};

export type ButtonTone = {
  background: keyof typeof colors;
  text: keyof typeof colors;
  border?: keyof typeof colors;
  height: number;
  textVariant: TextVariant;
  textWeight?: FontWeight;
  paddingHorizontal: number;
  shadow?: ViewStyle;
  /** Fill the parent's width (full-width screen buttons) or hug the label (pills). */
  stretch: boolean;
  /** Icon size and stroke; defaults to 20 and 2. */
  icon?: { size: number; strokeWidth: number };
  /** Stop the label growing past this text scale (a button laid over something, like Change cover). */
  maxTextScale?: number;
};

export const PRESSED_OPACITY = 0.85;
export const DISABLED_OPACITY = 0.45;

/** Shared body of the text buttons; use PrimaryButton, SecondaryButton, DangerButton or PillButton. */
export function BaseButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  icon,
  testID,
  tone,
}: ButtonProps & { tone: ButtonTone }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, tone.height)}
      testID={testID}
      style={[
        styles.base,
        {
          minHeight: tone.height,
          paddingHorizontal: tone.paddingHorizontal,
          backgroundColor: colors[tone.background],
          alignSelf: tone.stretch ? 'stretch' : 'flex-start',
        },
        tone.border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors[tone.border] } : null,
        tone.shadow,
        pressed && !disabled ? { opacity: PRESSED_OPACITY } : null,
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      {icon ? (
        <Icon name={icon} color={tone.text} size={tone.icon?.size ?? 20} strokeWidth={tone.icon?.strokeWidth ?? 2} />
      ) : null}
      <Text
        style={[textStyle(tone.textVariant, tone.textWeight), { color: colors[tone.text] }, styles.label]}
        maxFontSizeMultiplier={tone.maxTextScale}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    minWidth: sizes.minTap,
    // Never wider than its parent: a long label ("Be a reader" at large text) wraps instead (D-86).
    maxWidth: '100%',
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
