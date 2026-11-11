import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { PillButton } from '@/components/PillButton';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type JarCardProps = {
  count: number;
  /** Null while unknown (signed out or loading): the line then leaves the reader count out. */
  readerCount: number | null;
  lidColor?: string;
  /** First day, nothing captured yet: "Your first jar" (EmptyToday) instead of the count and Publish. */
  firstDay: boolean;
};

/** The dark card above the grid: the jar filled to today's count, readers and Publish (Main, EmptyToday). */
export function JarCard({ count, readerCount, lidColor, firstDay }: JarCardProps) {
  const { t } = useTranslation();
  const title = firstDay ? t('today.firstJarTitle') : t('jar.moments', { count, total: MAX_LAYERS });
  const subtitle = firstDay
    ? t('today.firstJarBody')
    : readerCount === null
      ? t('today.inTodaysJar')
      : t('today.inTodaysJarReaders', { count: readerCount });
  return (
    <View style={styles.card} testID={firstDay ? 'jar-card-first-day' : 'jar-card'}>
      <View style={styles.row}>
        <JarGraphic count={count} lidColor={lidColor} onDark decorative />
        <View accessible style={styles.text}>
          <Text style={[textStyle('jarCardTitle'), { color: colors.surface }]}>{title}</Text>
          <Text style={[textStyle(firstDay ? 'bodySmall' : 'label', '500'), { color: colors.onDarkMuted }]}>
            {subtitle}
          </Text>
        </View>
        {firstDay ? null : (
          // TODO(M3-01 #62): open Publish review. Disabled until that screen exists.
          <PillButton
            label={t('today.publish')}
            accessibilityHint={t('today.publishHint')}
            onPress={() => {}}
            disabled
            testID="today-publish"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: sizes.cardPadding,
    paddingRight: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: sizes.cardPadding },
  text: { flex: 1, gap: space.xs },
});
