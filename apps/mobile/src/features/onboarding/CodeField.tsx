import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CODE_LENGTH } from '@/lib/auth';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type CodeFieldProps = {
  /** Characters typed so far (0–6). */
  value: string;
  /** `digits` for the emailed sign-in code; `invite` for an invite code: letters and digits from the
   * invite alphabet, upper case (INV-06). */
  kind?: 'digits' | 'invite';
  /** Called with allowed characters only, never more than six. */
  onChangeText: (value: string) => void;
  /** Spoken name of the field. Already translated. */
  label: string;
  /** Red boxes after a wrong or expired code. */
  invalid: boolean;
  /** False while the code is being checked. */
  editable: boolean;
  testID?: string;
};

// The invite alphabet (0132): no 0/O or 1/I/L.
const NOT_INVITE = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

/**
 * The 6-digit code on Check your email (FR-ACC-02, D-60). One TextInput, so iOS offers the code from Mail
 * above the keyboard and paste fills every box; it sits over the six boxes, almost transparent, and takes
 * the taps. The boxes only draw the digits and are hidden from screen readers, which read the field.
 * The invite kind (Waiting) takes letters too and doesn't open the keyboard by itself.
 */
export function CodeField({ value, kind = 'digits', onChangeText, label, invalid, editable, testID }: CodeFieldProps) {
  const invite = kind === 'invite';
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
        onChangeText={(text) =>
          onChangeText(
            (invite ? text.toUpperCase().replace(NOT_INVITE, '') : text.replace(/\D/g, '')).slice(0, CODE_LENGTH),
          )
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType={invite ? 'default' : 'number-pad'}
        textContentType={invite ? 'none' : 'oneTimeCode'}
        autoComplete={invite ? 'off' : 'one-time-code'}
        autoCapitalize={invite ? 'characters' : 'none'}
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        autoFocus={!invite}
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
