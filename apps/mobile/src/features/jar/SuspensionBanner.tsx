import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { formatShortDate } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

export type SuspensionBannerProps = {
  /** End of the suspension (ISO time), or null when it has no end date. */
  until: string | null;
  /** The phone's IANA zone, for the end date. */
  tz: string;
};

/**
 * Suspension notice on Today (FR-SAF-06, D-11; no design, G-15): the owner still sees their own days, but
 * others can't see them and nothing can be added or shared until the date. Styled like the offline banner.
 */
export function SuspensionBanner({ until, tz }: SuspensionBannerProps) {
  const { t } = useTranslation();
  const title = until
    ? t('today.suspended.title', { date: formatShortDate(new Date(until), tz) })
    : t('today.suspended.titleNoDate');
  const body = t('today.suspended.body');
  return (
    <View
      testID="suspension-banner"
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title} ${body}`}
      style={styles.banner}
    >
      <Icon name="lock" color="surface" size={18} strokeWidth={2} />
      <Text style={[textStyle('bodySmall'), styles.text]}>
        <Text style={textStyle('bodySmall', '700')}>{title}</Text> {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.bannerGap,
    paddingVertical: sizes.bannerPaddingY,
    paddingHorizontal: sizes.bannerPaddingX,
    borderRadius: radius.banner,
    backgroundColor: colors.ink,
  },
  text: { flex: 1, color: colors.surface },
});
