import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { JarGraphic } from '@/components/JarGraphic';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { DaySlot } from '@/lib/jars';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

const TIPS: { icon: IconName; key: 'snap' | 'private' | 'later' }[] = [
  { icon: 'capture', key: 'snap' },
  { icon: 'lock', key: 'private' },
  { icon: 'myDays', key: 'later' },
];

export type FirstMomentTipProps = {
  visible: boolean;
  /** The current day slot, or null before 05:00 (any slot). */
  slot: DaySlot | null;
  lidColor?: string;
  onTake: () => void;
  onClose: () => void;
  /** The sheet's modal is gone: only now can Camera open (iOS can't present over a closing modal). */
  onClosed?: () => void;
};

/** First moment tip (FR-ONB-08, design: Coach): a sheet over the first-day Today. */
export function FirstMomentTip({ visible, slot, lidColor, onTake, onClose, onClosed }: FirstMomentTipProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      accessibilityLabel={t('firstTip.label')}
      testID="first-tip"
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <JarGraphic count={0} size={sizes.tipJar} lidColor={lidColor} decorative />
          <View style={styles.text}>
            <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
              {t('firstTip.title')}
            </Text>
            <Text style={[textStyle('bodyMedium'), { color: colors.inkSoft }]}>
              {slot ? t('firstTip.ready', { period: t(`firstTip.periods.${slot}`), slot }) : t('firstTip.readyAny')}
            </Text>
          </View>
        </View>
        {TIPS.map(({ icon, key }) => (
          <View key={key} style={styles.tip}>
            <View style={styles.icon}>
              <Icon name={icon} color="ink" size={20} />
            </View>
            <Text style={[textStyle('body'), styles.tipText]}>{t(`firstTip.${key}`)}</Text>
          </View>
        ))}
        <PrimaryButton icon="capture" label={t('firstTip.take')} onPress={onTake} testID="first-tip-take" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('firstTip.look')}
          onPress={onClose}
          hitSlop={hitSlopFor(undefined, 24)}
          style={styles.look}
          testID="first-tip-look"
        >
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{t('firstTip.look')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: sizes.tileIconWell,
    height: sizes.tileIconWell,
    borderRadius: radius.optionIcon,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, color: colors.inkSoft },
  look: { alignItems: 'center', paddingVertical: space.xs },
});
