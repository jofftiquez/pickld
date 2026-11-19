import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { PillButton } from '@/components/PillButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { photoSource } from '@/lib/image/photoCache';
import { photoPlaceholder } from '@/lib/image/photoPlaceholders';
import { formatShortDate } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { MOMENTS_PER_JAR } from './monthGrid';
import type { UnpublishedJar } from './unpublishedJars';

export type UnpublishedViewProps = {
  /** Undefined while the list is read for the first time. */
  jars: UnpublishedJar[] | undefined;
  insets: EdgeInsets;
  /** The last Keep to myself didn't reach the server. */
  keepFailed?: boolean;
  onBack: () => void;
  /** Opens the day page. */
  onOpen: (jar: UnpublishedJar) => void;
  onPublish: (jar: UnpublishedJar) => void;
  onKeep: (jarIds: string[]) => void;
  locale?: string;
};

// A calendar date at noon UTC, so the label is that date whatever the phone zone.
const dateLabel = (localDate: string, locale?: string) =>
  formatShortDate(new Date(`${localDate}T12:00:00Z`), 'UTC', locale);

/**
 * Not published (FR-DAY-02, FR-PUB-01): past days from the last week that hold moments but weren't published.
 * Each has Publish (the review for that day) and Keep to myself, which takes it off this list for good; Keep all
 * to myself clears the list after a confirm. Opened from My jars. Nothing here changes who sees a moment.
 */
export function UnpublishedView({
  jars,
  insets,
  keepFailed = false,
  onBack,
  onOpen,
  onPublish,
  onKeep,
  locale,
}: UnpublishedViewProps) {
  const { t } = useTranslation();
  const [confirmAll, setConfirmAll] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="unpublished-screen">
      <View style={styles.header}>
        <RoundIconButton
          icon="back"
          accessibilityLabel={t('unpublished.back')}
          onPress={onBack}
          testID="unpublished-back"
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
        >
          {t('unpublished.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {jars === undefined ? (
          <ActivityIndicator color={colors.muted} style={styles.message} testID="unpublished-loading" />
        ) : jars.length === 0 ? (
          <EmptyState
            illustration="check"
            title={t('unpublished.emptyTitle')}
            body={t('unpublished.empty')}
            testID="unpublished-empty"
          />
        ) : (
          <>
            <Text style={[textStyle('bodySmall'), styles.intro]}>{t('unpublished.intro')}</Text>
            {keepFailed ? (
              <Text accessibilityLiveRegion="polite" style={[textStyle('bodySmall', '600'), styles.error]}>
                {t('unpublished.keepFailed')}
              </Text>
            ) : null}
            <View style={styles.card}>
              {jars.map((jar, i) => (
                <Row
                  key={jar.id}
                  jar={jar}
                  day={dateLabel(jar.localDate, locale)}
                  divider={i < jars.length - 1}
                  onOpen={onOpen}
                  onPublish={onPublish}
                  onKeep={(id) => onKeep([id])}
                />
              ))}
            </View>
            {jars.length > 1 ? (
              <SecondaryButton
                variant="outline"
                label={t('unpublished.keepAll')}
                accessibilityHint={t('unpublished.keepAllHint')}
                onPress={() => setConfirmAll(true)}
                testID="unpublished-keep-all"
              />
            ) : null}
          </>
        )}
      </ScrollView>
      <Dialog
        visible={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={t('unpublished.keepAllTitle', { count: jars?.length ?? 0 })}
        message={t('unpublished.keepAllMessage')}
        testID="unpublished-keep-all-dialog"
      >
        <PrimaryButton
          label={t('unpublished.keepAllConfirm')}
          onPress={() => {
            setConfirmAll(false);
            onKeep((jars ?? []).map((jar) => jar.id));
          }}
          testID="unpublished-keep-all-confirm"
        />
      </Dialog>
    </View>
  );
}

type RowProps = {
  jar: UnpublishedJar;
  day: string;
  divider: boolean;
  onOpen: (jar: UnpublishedJar) => void;
  onPublish: (jar: UnpublishedJar) => void;
  onKeep: (jarId: string) => void;
};

function Row({ jar, day, divider, onOpen, onPublish, onKeep }: RowProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const count = t('unpublished.count', { count: jar.momentCount, total: MOMENTS_PER_JAR });
  return (
    <View style={[styles.row, divider ? styles.divider : null]} testID={`unpublished-row-${jar.localDate}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('unpublished.rowLabel', { day, count })}
        accessibilityHint={t('unpublished.openHint')}
        onPress={() => onOpen(jar)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.body, pressed ? { opacity: PRESSED_OPACITY } : null]}
        testID={`unpublished-open-${jar.localDate}`}
      >
        {jar.coverUrl ? (
          <Image
            source={photoSource(jar.coverUrl)}
            placeholder={photoPlaceholder(jar.coverUrl)}
            placeholderContentFit="cover"
            style={styles.thumb}
            contentFit="cover"
            accessible={false}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}
        <View style={styles.names}>
          <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
            {day}
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
            {count}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <PillButton
          label={t('unpublished.publish')}
          accessibilityLabel={t('unpublished.publishLabel', { day })}
          onPress={() => onPublish(jar)}
          testID={`unpublished-publish-${jar.localDate}`}
        />
        <PillButton
          variant="subtle"
          label={t('unpublished.keep')}
          accessibilityLabel={t('unpublished.keepLabel', { day })}
          accessibilityHint={t('unpublished.keepHint')}
          onPress={() => onKeep(jar.id)}
          testID={`unpublished-keep-${jar.localDate}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit one line at large text instead of pushing the back button off screen (D-37).
  headerTitle: { flexShrink: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.lg },
  intro: { color: colors.inkSoft, marginHorizontal: space.xs, lineHeight: 19 },
  error: { color: colors.danger, marginHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: sizes.cardPadding,
    paddingVertical: space.xs,
    ...shadow.card,
  },
  // Wraps at large text: the two pills drop under the day.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.sm + 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  body: {
    flexGrow: 1,
    flexBasis: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: sizes.roundButton,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  thumb: { width: sizes.pendingThumbWidth, aspectRatio: 3 / 4, borderRadius: radius.pendingThumb },
  thumbEmpty: { backgroundColor: colors.dayCellEmpty },
  names: { flex: 1, gap: 1 },
  message: { marginTop: space.xxl },
});
