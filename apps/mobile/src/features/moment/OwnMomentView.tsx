import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import { CheckingView } from './CheckingView';
import { RemovedView } from './RemovedView';
import type { OwnMomentResult } from './useOwnMoment';

export type OwnMomentViewProps = {
  result: OwnMomentResult;
  insets: { top: number; bottom: number };
  onClose: () => void;
};

/**
 * /moment/[id] for the owner's own moment while it is checked or after it was removed. Anything else
 * (another user's moment, a bad or unknown id) is "not found" and shows no photo.
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
    // A live moment opens Moment detail; the route renders that instead.
    return null;
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
  light: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xxl },
  center: { alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, gap: space.md },
  text: { textAlign: 'center', color: colors.ink },
});
