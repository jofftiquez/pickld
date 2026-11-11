import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import type { Visibility } from '@/features/publish/publishJar';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

export type PublishedNoteProps = {
  /** "2:30 PM", already formatted in the phone's zone. */
  time: string;
  visibility: Visibility;
};

/** "Published at 2:30 PM. New moments you add today go out automatically." above the jar card (TodayPublished; FR-PUB-04). */
export function PublishedNote({ time, visibility }: PublishedNoteProps) {
  const { t } = useTranslation();
  // Only me shares nothing, so it says so instead of promising moments "go out".
  const text = t(visibility === 'only_me' ? 'today.publishedNoteOnlyMe' : 'today.publishedNote', { time });
  return (
    <View testID="published-note" accessible accessibilityLabel={text} style={styles.note}>
      <Icon name="sparkle" color="brandText" size={18} />
      <Text style={[textStyle('bodySmall', '600'), styles.text]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.bannerGap,
    paddingVertical: sizes.bannerPaddingY,
    paddingHorizontal: sizes.bannerPaddingX,
    borderRadius: radius.banner,
    backgroundColor: colors.brandTint,
  },
  text: { flex: 1, color: colors.brandText },
});
