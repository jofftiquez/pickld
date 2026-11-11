import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type TextFieldProps = {
  /** Visible label above the field; also its spoken name. Already translated. */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Typing is finished: the field lost focus or Return was pressed. */
  onEndEditing?: () => void;
  /** Shows "n / max" under the field and stops input past max. */
  maxLength?: number;
  /** Multi-line bio-style field (74 px tall). */
  multiline?: boolean;
  placeholder?: string;
  accessibilityHint?: string;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  keyboardType?: TextInputProps['keyboardType'];
  /** Focus the field (and show the keyboard) when it appears. */
  autoFocus?: boolean;
  testID?: string;
};

/** Labelled text input from EditProfile, with an optional character counter. */
export function TextField({
  label,
  value,
  onChangeText,
  onEndEditing,
  maxLength,
  multiline = false,
  placeholder,
  accessibilityHint,
  autoCapitalize,
  autoComplete,
  keyboardType,
  autoFocus,
  testID,
}: TextFieldProps) {
  const { t } = useTranslation();
  const count = value.length;
  return (
    <View style={styles.container}>
      <Text style={[textStyle('label'), styles.label]} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        maxLength={maxLength}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        textAlignVertical={multiline ? 'top' : 'center'}
        testID={testID}
        style={[textStyle('body'), styles.input, multiline ? styles.multiline : styles.single]}
      />
      {maxLength !== undefined ? (
        <Text
          style={[textStyle('caption', '500'), styles.counter]}
          accessibilityLabel={t('forms.characterCount', { count, max: maxLength })}
          accessibilityLiveRegion="polite"
        >
          {`${count} / ${maxLength}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, alignSelf: 'stretch' },
  label: { color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: 14,
  },
  // minHeight so the field grows with 200% text instead of clipping.
  single: { minHeight: sizes.textField },
  multiline: { minHeight: sizes.textArea, paddingTop: space.md, paddingBottom: space.md },
  counter: { alignSelf: 'flex-end', color: colors.muted },
});
