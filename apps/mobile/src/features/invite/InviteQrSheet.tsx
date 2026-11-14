import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { BaseButton } from '@/components/BaseButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { textStyle } from '@/theme/text';
import { colors, invite, shadow, sizes, space } from '@/theme/tokens';

import { inviteUrl, type InviteCode } from './invites';
import { qrPath } from './qr';

export type InviteQrSheetProps = {
  /** The code shown; null hides the sheet. */
  code: InviteCode | null;
  onShare: (code: InviteCode) => void;
  onClose: () => void;
};

/**
 * One code's QR, full screen in its moment's color (design: InviteQR). The QR is drawn on the phone and
 * encodes pickld.me/i/<code>, which a phone camera opens and Scan QR in Pickld reads (INV-06).
 */
export function InviteQrSheet({ code, onShare, onClose }: InviteQrSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const qr = useMemo(() => (code ? qrPath(inviteUrl(code.code), invite.qrMargin) : null), [code]);
  return (
    <Modal
      visible={code !== null}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="invite-qr-modal"
    >
      {code && qr ? (
        <View
          style={[styles.screen, { backgroundColor: invite.slotColors[code.slot], paddingTop: insets.top }]}
          accessibilityViewIsModal
          testID="invite-qr"
        >
          <View style={styles.header}>
            <RoundIconButton
              icon="close"
              accessibilityLabel={t('invite.qrClose')}
              onPress={onClose}
              testID="invite-qr-close"
            />
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
            <Text style={[textStyle('eyebrow'), styles.white]}>
              {t('invite.qrEyebrow', { tag: t(`slots.${code.slot}`) }).toUpperCase()}
            </Text>
            <Text accessibilityRole="header" style={[textStyle('unlockTitle'), styles.white, styles.center]}>
              {t('invite.qrTitle')}
            </Text>
            <View style={styles.card}>
              <Svg
                width={invite.qrSize}
                height={invite.qrSize}
                viewBox={`0 0 ${qr.size} ${qr.size}`}
                accessible
                accessibilityLabel={t('invite.qrA11y', { code: code.code.split('').join(' ') })}
                testID="invite-qr-code"
              >
                <Rect width={qr.size} height={qr.size} fill={colors.surface} />
                <Path d={qr.d} fill={colors.ink} />
              </Svg>
              <Text
                style={styles.code}
                allowFontScaling={false}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {code.code}
              </Text>
            </View>
            <Text style={[textStyle('bodyMedium'), styles.white, styles.center, styles.note]}>
              {t('invite.qrNote')}
            </Text>
            <View style={styles.spacer} />
            <View style={styles.actions}>
              <View style={styles.action}>
                <BaseButton
                  label={t('invite.qrShare')}
                  icon="share"
                  onPress={() => onShare(code)}
                  testID="invite-qr-share"
                  tone={{
                    background: 'surface',
                    text: 'ink',
                    height: sizes.buttonPrimary,
                    textVariant: 'button',
                    paddingHorizontal: space.lg,
                    stretch: true,
                  }}
                />
              </View>
              <View style={styles.action}>
                <BaseButton
                  label={t('invite.qrDone')}
                  onPress={onClose}
                  testID="invite-qr-done"
                  tone={{
                    background: 'onColorButton',
                    text: 'surface',
                    height: sizes.buttonPrimary,
                    textVariant: 'button',
                    paddingHorizontal: space.lg,
                    stretch: true,
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.xxl },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xxxl,
    paddingTop: space.sm,
  },
  white: { color: colors.surface },
  center: { textAlign: 'center' },
  card: {
    marginTop: space.md + 2,
    backgroundColor: colors.surface,
    borderRadius: invite.qrCardRadius,
    padding: invite.qrCardPadding,
    alignItems: 'center',
    ...shadow.dialog,
  },
  code: {
    ...textStyle('button', '800'),
    marginTop: space.md + 2,
    fontSize: invite.qrCodeSize,
    letterSpacing: invite.qrCodeSpacing,
    color: colors.ink,
  },
  note: { marginTop: space.sm + 2, lineHeight: 21 },
  spacer: { flex: 1, minHeight: space.lg },
  actions: { flexDirection: 'row', gap: space.sm + 2, alignSelf: 'stretch' },
  action: { flex: 1 },
});
