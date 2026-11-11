import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, photo, space } from '@/theme/tokens';

import { CheckingView } from './CheckingView';
import { RemovedView } from './RemovedView';
import type { OwnMomentResult } from './useOwnMoment';

export type OwnMomentViewProps = {
  result: OwnMomentResult;
  insets: { top: number; bottom: number };
  onClose: () => void;
};

/**
 * /moment/[id] for the owner's own moment: Checking photo, Moment removed, or the plain photo once it is
 * live. Anything else (another user's moment, a bad or unknown id) is "not found" and shows no photo.
 */
export function OwnMomentView({ result, insets, onClose }: OwnMomentViewProps) {
  const { t } = useTranslation();

  if (result.kind === 'found') {
    const { moment } = result;
    if (moment.status === 'checking') {
      return <CheckingView slot={moment.slot} photoUrl={moment.photoUrl} insets={insets} onClose={onClose} />;
    }
    if (moment.status === 'removed') {
      return (
        <RemovedView
          slot={moment.slot}
          localDate={moment.localDate}
          thumbUrl={moment.thumbUrl}
          guideline={moment.guideline}
          insets={insets}
          onClose={onClose}
        />
      );
    }
    // TODO(M3-08): the full Moment detail (progress bars, swipe, caption, likes, comments).
    return (
      <View style={[styles.dark, { paddingTop: insets.top }]} testID="moment-live">
        <View style={styles.livePhoto}>
          {moment.photoUrl ? (
            <Image
              testID="moment-live-photo"
              source={{ uri: moment.photoUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('moment.photo', { slot: t(`slots.${moment.slot}`) })}
            />
          ) : null}
          <View style={styles.liveClose}>
            <RoundIconButton
              icon="close"
              variant="glass"
              accessibilityLabel={t('moment.close')}
              onPress={onClose}
              testID="moment-close"
            />
          </View>
        </View>
      </View>
    );
  }

  if (result.kind === 'loading') {
    return (
      <View style={[styles.light, styles.center]} testID="moment-loading">
        <ActivityIndicator color={colors.ink} size="large" accessibilityLabel={t('moment.loading')} />
      </View>
    );
  }

  const copy = result.kind === 'error' ? 'moment.error' : 'moment.notFound';
  return (
    <View
      style={[styles.light, { paddingTop: insets.top + space.xxl, paddingBottom: Math.max(insets.bottom, space.xxl) }]}
      testID={result.kind === 'error' ? 'moment-error' : 'moment-not-found'}
    >
      <View style={[styles.center, styles.message]}>
        <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.text]}>
          {t(`${copy}.title`)}
        </Text>
        <Text style={[textStyle('body'), styles.text, { color: colors.muted }]}>{t(`${copy}.body`)}</Text>
      </View>
      <SecondaryButton label={t('moment.backToToday')} onPress={onClose} testID="moment-back-to-today" />
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.camera },
  livePhoto: { aspectRatio: photo.aspect, backgroundColor: colors.photoPlaceholder },
  liveClose: { position: 'absolute', top: space.lg, left: space.lg },
  light: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xxl },
  center: { alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, gap: space.md },
  text: { textAlign: 'center', color: colors.ink },
});
