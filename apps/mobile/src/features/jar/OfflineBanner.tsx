import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

export type OfflineBannerProps = {
  /** Moments saved on the phone that will upload on their own (see `offlineBannerCount`). */
  count: number;
};

/** "You're offline. N moments are saved on your phone…" above the jar card (UploadStates; NFR-OFF-01). */
export function OfflineBanner({ count }: OfflineBannerProps) {
  const { t } = useTranslation();
  const title = t('today.offline.title');
  const body = t('today.offline.body', { count });
  return (
    <View
      testID="offline-banner"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title} ${body}`}
      style={styles.banner}
    >
      <Icon name="wifiOff" color="surface" size={18} strokeWidth={2} />
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
