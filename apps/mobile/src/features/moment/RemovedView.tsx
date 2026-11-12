import { Image } from 'expo-image';
import { Trans, useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { formatShortDate } from '@/lib/format';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import type { GuidelineKey } from './useOwnMoment';

export type RemovedViewProps = {
  slot: Slot;
  /** The jar's local date (YYYY-MM-DD). */
  localDate: string;
  /** Signed thumbnail URL of the removed photo; shown blurred. Null shows the placeholder color. */
  thumbUrl: string | null;
  /** The guideline the moment broke; null says only "our community guidelines". */
  guideline: GuidelineKey | null;
  insets: { top: number; bottom: number };
  onClose: () => void;
};

/** A YYYY-MM-DD date as "Sat, Nov 7": read and printed in UTC so the day never shifts. */
function jarDate(localDate: string): string {
  return formatShortDate(new Date(`${localDate}T00:00:00Z`), 'UTC');
}

/**
 * Moment removed notice (design: Removed; FR-PUB-07, FR-SAF-05). Only the owner reaches it.
 * TODO(M3-24): the Request a review card (appeals). TODO(M4-17): the "Read the community guidelines" link
 * (Help).
 */
export function RemovedView({ slot, localDate, thumbUrl, guideline, insets, onClose }: RemovedViewProps) {
  const { t } = useTranslation();
  const tag = t(`slots.${slot}`);
  const bodyStyle = [textStyle('body'), styles.body];
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="moment-removed">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('moment.back')} onPress={onClose} testID="moment-back" />
        <Text accessibilityRole="header" style={[textStyle('cardTitle'), styles.headerTitle]}>
          {t('moment.removed.header')}
        </Text>
        <View style={styles.headerSide} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, space.xxl) }]}>
        <View style={styles.summary}>
          <View style={styles.thumb}>
            {thumbUrl ? (
              <Image
                testID="moment-removed-photo"
                source={{ uri: thumbUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={photo.checkingBlur}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('moment.removed.photo', { slot: tag })}
              />
            ) : null}
          </View>
          <View style={styles.summaryText}>
            <Text style={[textStyle('bodySmall', '700'), { color: colors.danger }]}>{t('moment.removed.label')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>
              {t('moment.removed.meta', { slot: tag, date: jarDate(localDate) })}
            </Text>
          </View>
        </View>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('noticeTitle'), { color: colors.ink }]}
        >
          {t('moment.removed.title')}
        </Text>
        {guideline ? (
          <Text style={bodyStyle} testID="moment-removed-reason">
            <Trans
              t={t}
              i18nKey="moment.removed.bodyGuideline"
              values={{ guideline: t(`moment.guideline.${guideline}`) }}
              components={{ bold: <Text style={textStyle('body', '700')} /> }}
            />
          </Text>
        ) : (
          <Text style={bodyStyle} testID="moment-removed-reason">
            {t('moment.removed.body')}
          </Text>
        )}
        <View style={styles.spacer} />
        <PrimaryButton label={t('moment.removed.ok')} onPress={onClose} testID="moment-removed-ok" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.xxl,
    paddingBottom: space.md,
    paddingHorizontal: space.lg,
  },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.ink },
  headerSide: { width: sizes.roundButton },
  content: { flexGrow: 1, paddingTop: space.sm, paddingHorizontal: space.xxl, gap: space.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: {
    width: sizes.noticeThumb,
    aspectRatio: photo.aspect,
    borderRadius: radius.thumbLg,
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
  },
  summaryText: { flex: 1, gap: space.xs / 2 },
  body: { color: colors.inkSoft },
  spacer: { flexGrow: 1 },
});
