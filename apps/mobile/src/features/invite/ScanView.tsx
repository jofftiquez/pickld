import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { textStyle } from '@/theme/text';
import { colors, join, sizes, space } from '@/theme/tokens';

export type ScanViewProps = {
  insets: EdgeInsets;
  /** The live camera (or the Simulator's stand-in) behind everything. */
  preview: ReactNode;
  /** `denied`: camera access is off, so ask for it in Settings instead of scanning. */
  access: 'live' | 'denied';
  /** A QR code that isn't a Pickld invite is in view. */
  notInvite: boolean;
  torch: boolean;
  hasTorch: boolean;
  onClose: () => void;
  onTorch: () => void;
  onTypeInstead: () => void;
  onOpenSettings: () => void;
};

const W = join.scanCornerWidth;
const R = join.scanCornerRadius;
const CORNERS = [
  { top: 0, left: 0, borderTopWidth: W, borderLeftWidth: W, borderTopLeftRadius: R },
  { top: 0, right: 0, borderTopWidth: W, borderRightWidth: W, borderTopRightRadius: R },
  { bottom: 0, left: 0, borderBottomWidth: W, borderLeftWidth: W, borderBottomLeftRadius: R },
  { bottom: 0, right: 0, borderBottomWidth: W, borderRightWidth: W, borderBottomRightRadius: R },
];

/**
 * Scan QR (INV-06; FR-INV-02; design: ScanQR): the camera with corner brackets, for a friend's invite QR.
 * Only pickld.me invite links are taken; any other code shows "That's not a Pickld invite".
 */
export function ScanView({
  insets,
  preview,
  access,
  notInvite,
  torch,
  hasTorch,
  onClose,
  onTorch,
  onTypeInstead,
  onOpenSettings,
}: ScanViewProps) {
  const { t } = useTranslation();
  const top = insets.top + space.lg;

  if (access === 'denied') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.denied,
          { paddingTop: top + sizes.roundButton, paddingBottom: insets.bottom + space.xxl },
        ]}
        testID="scan-denied"
      >
        <View style={styles.deniedMessage}>
          <Icon name="cameraOff" color="surface" size={34} strokeWidth={1.8} />
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.centered, styles.onDark]}>
            {t('join.cameraOffTitle')}
          </Text>
          <Text style={[textStyle('bodyMedium'), styles.centered, styles.onDarkSoft]}>{t('join.cameraOffBody')}</Text>
        </View>
        <PrimaryButton label={t('join.openSettings')} onPress={onOpenSettings} testID="scan-open-settings" />
        <TypeInstead onPress={onTypeInstead} />
        <View style={[styles.close, { top }]}>
          <RoundIconButton icon="close" variant="glass" accessibilityLabel={t('join.close')} onPress={onClose} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root} testID="scan">
      {preview}
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
      <View style={[styles.content, { paddingTop: top, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.centered, styles.onDark]}>
            {t('join.scanTitle')}
          </Text>
          <Text style={[textStyle('bodyMedium'), styles.centered, styles.onDarkSoft]}>{t('join.scanBody')}</Text>
        </View>
        <View style={styles.frame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {CORNERS.map((c, i) => (
            <View key={i} style={[styles.corner, c]} />
          ))}
        </View>
        <View style={styles.errorSlot}>
          {notInvite ? (
            <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <Text style={[textStyle('bodySmall', '700'), styles.onDark]}>{t('join.scanNotInvite')}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.spacer} />
        <TypeInstead onPress={onTypeInstead} />
      </View>
      <View style={[styles.close, { top }]}>
        <RoundIconButton
          icon="close"
          variant="glass"
          accessibilityLabel={t('join.close')}
          onPress={onClose}
          testID="scan-close"
        />
      </View>
      {hasTorch ? (
        <View style={[styles.torch, { top }]}>
          <RoundIconButton
            icon={torch ? 'flashOff' : 'flash'}
            variant="glass"
            accessibilityLabel={t(torch ? 'join.torchOff' : 'join.torchOn')}
            onPress={onTorch}
            testID="scan-torch"
          />
        </View>
      ) : null}
    </View>
  );
}

function TypeInstead({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('join.typeInstead')}
      onPress={onPress}
      hitSlop={space.md}
      style={styles.typeInstead}
      testID="scan-type-instead"
    >
      <Text style={[textStyle('bodyMedium', '700'), styles.onDark, styles.underline]}>{t('join.typeInstead')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera },
  shade: { backgroundColor: join.scanShade },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: space.xxl },
  header: { marginTop: sizes.roundButton + space.lg, gap: space.sm, alignItems: 'center' },
  centered: { textAlign: 'center' },
  onDark: { color: colors.surface },
  onDarkSoft: { color: colors.surface, opacity: 0.85 },
  frame: { width: join.scanFrame, height: join.scanFrame, marginTop: space.xxxl * 2 },
  corner: { position: 'absolute', width: join.scanCorner, height: join.scanCorner, borderColor: colors.surface },
  errorSlot: { marginTop: space.xxl, minHeight: sizes.roundButton },
  error: {
    backgroundColor: join.scanErrorFill,
    borderRadius: sizes.roundButton,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  spacer: { flex: 1 },
  typeInstead: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  close: { position: 'absolute', left: space.xxl },
  torch: { position: 'absolute', right: space.xxl },
  denied: { flexGrow: 1, paddingHorizontal: space.xxl, gap: space.lg, justifyContent: 'center' },
  deniedMessage: { alignItems: 'center', gap: space.md, marginBottom: space.lg },
});
