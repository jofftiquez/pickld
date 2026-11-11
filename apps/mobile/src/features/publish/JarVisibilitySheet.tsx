import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import type { Visibility } from './publishJar';
import { VisibilityOptions } from './VisibilityOptions';

export type JarVisibilitySheetProps = {
  visible: boolean;
  visibility: Visibility;
  readerCount: number | null;
  /** A change is saving: the rows ignore taps until it finishes. */
  busy: boolean;
  error: 'refused' | 'failed' | null;
  /** A different choice was tapped; the owner applies it and closes the sheet on success. */
  onChange: (visibility: Visibility) => void;
  onClose: () => void;
};

/**
 * The owner's jar menu on Today after publishing (FR-PUB-03): who can see the jar, applied on tap.
 * No design of its own; built from the kit sheet and Publish review's choices (G-15).
 */
export function JarVisibilitySheet({
  visible,
  visibility,
  readerCount,
  busy,
  error,
  onChange,
  onClose,
}: JarVisibilitySheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('jarVisibility.title')}
      testID="jar-visibility"
    >
      <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.title]}>
        {t('jarVisibility.title')}
      </Text>
      <Text style={[textStyle('label', '500'), styles.body]}>{t('jarVisibility.body')}</Text>
      <View accessibilityRole="radiogroup">
        <VisibilityOptions
          visibility={visibility}
          readerCount={readerCount}
          onChange={(next) => {
            if (next !== visibility) onChange(next);
          }}
          disabled={busy}
          testIDPrefix="jar-visibility"
        />
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[textStyle('bodySmall', '600'), styles.error]}
          testID="jar-visibility-error"
        >
          {t(`jarVisibility.error.${error}`)}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink },
  body: { color: colors.muted, marginTop: 2, marginBottom: space.xs },
  error: { color: colors.danger, marginTop: space.md },
});
