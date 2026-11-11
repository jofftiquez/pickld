import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

export type TimeZoneBannerProps = {
  /** Readable place of the previous jar's zone, e.g. "Manila" (see `zoneCity`). */
  from: string;
  /** Readable place of this jar's zone, e.g. "Tokyo". */
  to: string;
  /** Got it: hides the banner and records it for this jar. */
  onDismiss: () => void;
};

/** "You're in Tokyo time" card under the Today header, shown once per zone change (TimeZone; FR-JAR-05). */
export function TimeZoneBanner({ from, to, onDismiss }: TimeZoneBannerProps) {
  const { t } = useTranslation();
  const title = t('timeZone.title', { zone: to });
  const body = t('timeZone.body', { from, to });
  return (
    <View testID="timezone-banner" style={styles.banner}>
      <View style={styles.icon}>
        <Icon name="afternoon" color="zoneText" size={20} />
      </View>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${title} ${body}`}
        style={styles.text}
      >
        <Text style={[textStyle('bodyMedium', '700'), { color: colors.ink }]}>{title}</Text>
        <Text style={[textStyle('label', '500'), { color: colors.muted }]}>{body}</Text>
      </View>
      <PillButton
        variant="subtle"
        label={t('timeZone.gotIt')}
        accessibilityHint={t('timeZone.gotItHint')}
        onPress={onDismiss}
        testID="timezone-got-it"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: sizes.bannerPaddingX,
    borderRadius: radius.zoneBanner,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  icon: {
    width: sizes.zoneIcon,
    height: sizes.zoneIcon,
    borderRadius: radius.zoneIcon,
    backgroundColor: colors.zoneTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space.xs },
});
