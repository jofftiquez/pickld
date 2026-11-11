import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

export type CheckingViewProps = {
  slot: Slot;
  /** Signed URL of the owner's photo; null shows the placeholder color. */
  photoUrl: string | null;
  insets: { top: number; bottom: number };
  onClose: () => void;
};

/**
 * Checking photo (design: Checking; FR-SAF-03, FR-PUB-07). Only the owner reaches it: the photo stays
 * blurred until moderation approves it (rule 4), with the owner-only note below.
 */
export function CheckingView({ slot, photoUrl, insets, onClose }: CheckingViewProps) {
  const { t } = useTranslation();
  const tag = t(`slots.${slot}`);
  const reduceMotion = useReduceMotion();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} bounces={false} testID="moment-checking">
      <View style={styles.photo}>
        {photoUrl ? (
          <Image
            testID="moment-checking-photo"
            source={{ uri: photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={photo.checkingBlur}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('moment.checking.photo', { slot: tag })}
          />
        ) : null}
        {/* Dims the blurred photo so the white text stays readable on any picture. */}
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
        <View style={[styles.close, { top: insets.top + space.lg }]}>
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('moment.close')}
            onPress={onClose}
            testID="moment-close"
          />
        </View>
        <View style={styles.status} accessible accessibilityRole="progressbar">
          {/* Reduce Motion: a still clock instead of the spinner (rule 11). */}
          {reduceMotion ? (
            <Icon name="clock" color="surface" size={36} strokeWidth={2} />
          ) : (
            <ActivityIndicator color={colors.surface} size="large" />
          )}
          <Text style={[textStyle('cardTitle', '800'), styles.statusText]}>{t('moment.checking.title')}</Text>
          <Text style={[textStyle('bodySmall'), styles.statusText, { color: colors.onDarkMuted }]}>
            {t('moment.checking.body')}
          </Text>
        </View>
      </View>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.xxl) }]}>
        <View style={styles.note} testID="moment-owner-note">
          <View style={styles.noteIcon}>
            <Icon name="lock" color="brandText" size={20} />
          </View>
          <View style={styles.noteText}>
            <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('moment.checking.noteTitle')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>{t('moment.checking.noteBody')}</Text>
          </View>
        </View>
        <View style={styles.spacer} />
        <SecondaryButton
          variant="outline"
          label={t('moment.backToToday')}
          onPress={onClose}
          testID="moment-back-to-today"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  content: { flexGrow: 1 },
  photo: { aspectRatio: photo.aspect, overflow: 'hidden', backgroundColor: colors.camera },
  dim: { backgroundColor: colors.glass },
  close: { position: 'absolute', left: space.lg },
  status: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.xxl,
  },
  statusText: { color: colors.surface, textAlign: 'center' },
  sheet: {
    flexGrow: 1,
    marginTop: -space.xxl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.noteSheet,
    borderTopRightRadius: radius.noteSheet,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  noteIcon: {
    width: sizes.noteIcon,
    height: sizes.noteIcon,
    borderRadius: radius.thumbLg,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteText: { flex: 1, gap: space.xs / 2 },
  spacer: { flexGrow: 1 },
});
