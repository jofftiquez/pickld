import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CODE_LENGTH } from '@/lib/auth';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type CodeFieldProps = {
  /** Digits typed so far (0–6). */
  value: string;
  /** Called with digits only, never more than six. */
  onChangeText: (value: string) => void;
  /** Spoken name of the field. Already translated. */
  label: string;
  /** Red boxes after a wrong or expired code. */
  invalid: boolean;
  /** False while the code is being checked. */
  editable: boolean;
  testID?: string;
};

/**
 * The 6-digit code on Check your email (FR-ACC-02, D-60). One TextInput, so iOS offers the code from Mail
 * above the keyboard and paste fills every box; it sits over the six boxes, almost transparent, and takes
 * the taps. The boxes only draw the digits and are hidden from screen readers, which read the field.
 */
export function CodeField({ value, onChangeText, label, invalid, editable, testID }: CodeFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.row}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const active = focused && editable && i === Math.min(value.length, CODE_LENGTH - 1);
        return (
          <View
            key={i}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.box, invalid ? styles.invalid : active ? styles.active : null]}
          >
            <Text maxFontSizeMultiplier={maxTextScale.title} style={[textStyle('sectionTitle'), styles.digit]}>
              {value[i] ?? ''}
            </Text>
          </View>
        );
      })}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus
        caretHidden
        testID={testID}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  // flex: 1 shares the width; minHeight lets a box grow with 200% text instead of clipping the digit.
  box: {
    flex: 1,
    minHeight: sizes.codeBox,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // brandLink, not brand: a focus ring needs 3:1 against white.
  active: { borderColor: colors.brandLink },
  invalid: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  digit: { color: colors.ink },
  // Nearly invisible rather than hidden: iOS only offers the emailed code to a field that's on screen.
  input: { ...StyleSheet.absoluteFill, opacity: 0.02, color: colors.ink },
});
