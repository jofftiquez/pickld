import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

export type CaughtUpLineProps = {
  /** Which list it sits in, for the line under the title. */
  timeline: 'moments' | 'jars';
};

/**
 * "You're all caught up": a quiet line above the first post that was already there on the last visit, so people
 * know where the new posts end and can stop. It only marks a place; the list's order never changes.
 */
export function CaughtUpLine({ timeline }: CaughtUpLineProps) {
  const { t } = useTranslation();
  const body = t(timeline === 'moments' ? 'feed.caughtUpMoments' : 'feed.caughtUpJars');
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${t('feed.caughtUp')}. ${body}`}
      testID="caught-up-line"
    >
      <View style={styles.rule}>
        <View style={styles.hairline} />
        <View style={styles.check}>
          <Icon name="check" color="brandText" size={18} strokeWidth={2.4} />
        </View>
        <View style={styles.hairline} />
      </View>
      <Text style={[textStyle('cardTitle'), styles.title]}>{t('feed.caughtUp')}</Text>
      <Text style={[textStyle('bodySmall'), styles.body]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: space.lg, gap: space.xs },
  rule: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: space.md, marginBottom: space.sm },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border },
  check: {
    width: sizes.caughtUpIcon,
    height: sizes.caughtUpIcon,
    borderRadius: sizes.caughtUpIcon / 2,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.ink, textAlign: 'center' },
  body: { color: colors.muted, textAlign: 'center' },
});
