import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { JAR_LINE_MAX } from './jarLine';

export type DayLineProps = {
  /** The jar's line, or null when it has none. */
  line: string | null;
  /** Saves the line (an empty one clears it); rejects when it couldn't be saved. */
  onSave: (line: string) => Promise<unknown>;
};

/**
 * The owner's line for the day on Today and the day page (0175): "Add a line for the day" until there is one,
 * then the line itself; either opens the field in place, with Cancel and Save. Whoever may open the jar sees
 * the line on its Jar page.
 */
export function DayLine({ line, onSave }: DayLineProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Plain style array, not a style function: NativeWind's Pressable wrapper drops function styles on device.
  const [pressed, setPressed] = useState(false);

  const save = async () => {
    if (draft === null || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSave(draft);
      setDraft(null);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (draft === null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={line ? t('dayLine.label', { line }) : t('dayLine.add')}
        accessibilityHint={t('dayLine.editHint')}
        onPress={() => {
          setFailed(false);
          setDraft(line ?? '');
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.row, line ? null : styles.empty, pressed ? { opacity: PRESSED_OPACITY } : null]}
        testID="day-line"
      >
        <Icon name="edit" color={line ? 'muted' : 'brandText'} size={18} strokeWidth={2} />
        <Text
          style={[textStyle(line ? 'body' : 'bodySmall', line ? '500' : '700'), line ? styles.line : styles.addText]}
          testID="day-line-text"
        >
          {line ? t('dayLine.quoted', { line }) : t('dayLine.add')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor} testID="day-line-editor">
      <TextField
        label={t('dayLine.field')}
        value={draft}
        onChangeText={setDraft}
        maxLength={JAR_LINE_MAX}
        placeholder={t('dayLine.placeholder')}
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        autoFocus
        testID="day-line-input"
      />
      {failed ? (
        <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), styles.error]} testID="day-line-error">
          {t('dayLine.failed')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PillButton
          variant="subtle"
          label={t('dayLine.cancel')}
          onPress={() => setDraft(null)}
          disabled={saving}
          testID="day-line-cancel"
        />
        <PillButton label={t('dayLine.save')} onPress={() => void save()} disabled={saving} testID="day-line-save" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: sizes.minTap,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashed, backgroundColor: colors.surfaceClear },
  line: { flex: 1, color: colors.ink },
  addText: { flex: 1, color: colors.brandText },
  editor: { gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  error: { color: colors.danger },
});
