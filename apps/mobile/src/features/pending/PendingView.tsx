import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { pastDayLabel } from '@/features/days/pastDay';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import type { PendingDay, PendingRow, PendingStatus } from './pendingGroups';

export type PendingViewProps = {
  /** Undefined while the queue is read for the first time. */
  days: PendingDay[] | undefined;
  now: Date;
  insets: EdgeInsets;
  onBack: () => void;
  /** Opens the photo in the editor: a draft to finish it, any other to change it before it uploads. */
  onOpen: (row: PendingRow) => void;
  onRetry: (row: PendingRow) => void;
  onReplace: (row: PendingRow) => void;
  onDiscard: (row: PendingRow) => void;
};

/** The one action that moves a row along, beside its Discard. */
const mainAction: Partial<Record<PendingStatus, 'finish' | 'retry' | 'replace'>> = {
  draft: 'finish',
  failed: 'retry',
  conflict: 'replace',
};

/**
 * Pending uploads (FR-CAP-04, NFR-OFF-01): every moment still on the phone, across all days, grouped by day
 * with its slot. A row opens in the editor; drafts get Finish, failed uploads Retry, a taken slot Replace,
 * and anything not mid-upload Discard (after a confirm).
 */
export function PendingView({ days, now, insets, onBack, onOpen, onRetry, onReplace, onDiscard }: PendingViewProps) {
  const { t } = useTranslation();
  const [discarding, setDiscarding] = useState<PendingRow | null>(null);
  const dayLabel = (day: PendingDay) => pastDayLabel(day.localDate, now, day.tz) ?? t('pending.today');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="pending-screen">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('pending.back')} onPress={onBack} testID="pending-back" />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
        >
          {t('pending.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {days === undefined ? (
          <ActivityIndicator color={colors.muted} style={styles.message} testID="pending-loading" />
        ) : days.length === 0 ? (
          <EmptyState
            illustration="check"
            title={t('pending.emptyTitle')}
            body={t('pending.empty')}
            testID="pending-empty"
          />
        ) : (
          <>
            <Text style={[textStyle('bodySmall'), styles.intro]}>{t('pending.intro')}</Text>
            {days.map((day) => (
              <View key={day.localDate} style={styles.day} testID={`pending-day-${day.localDate}`}>
                <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.dayLabel]}>
                  {dayLabel(day)}
                </Text>
                <View style={styles.card}>
                  {day.rows.map((row, i) => (
                    <Row
                      key={row.id}
                      row={row}
                      day={dayLabel(day)}
                      divider={i < day.rows.length - 1}
                      onOpen={onOpen}
                      onRetry={onRetry}
                      onReplace={onReplace}
                      onDiscard={setDiscarding}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <Dialog
        visible={discarding !== null}
        onClose={() => setDiscarding(null)}
        title={t('pending.discardTitle')}
        message={t('pending.discardMessage')}
        testID="pending-discard"
      >
        <DangerButton
          label={t('pending.discardConfirm')}
          onPress={() => {
            if (discarding) onDiscard(discarding);
            setDiscarding(null);
          }}
          testID="pending-discard-confirm"
        />
      </Dialog>
    </View>
  );
}

type RowProps = {
  row: PendingRow;
  day: string;
  divider: boolean;
  onOpen: (row: PendingRow) => void;
  onRetry: (row: PendingRow) => void;
  onReplace: (row: PendingRow) => void;
  onDiscard: (row: PendingRow) => void;
};

function Row({ row, day, divider, onOpen, onRetry, onReplace, onDiscard }: RowProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const slot = t(`slots.${row.slot}`);
  const status = t(`pending.status.${row.status}`);
  // Mid-upload the row can't change: it has no actions until the upload ends.
  const busy = row.status === 'uploading';
  const action = mainAction[row.status];
  const onAction = action === 'finish' ? onOpen : action === 'retry' ? onRetry : onReplace;
  return (
    <View style={[styles.row, divider ? styles.divider : null]} testID={`pending-row-${row.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('pending.rowLabel', { slot, day, status })}
        accessibilityHint={busy ? undefined : t('pending.openHint')}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => onOpen(row)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.body, pressed ? { opacity: PRESSED_OPACITY } : null]}
        testID={`pending-open-${row.id}`}
      >
        <Image source={{ uri: row.uri }} style={styles.thumb} contentFit="cover" accessible={false} />
        <View style={styles.names}>
          <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
            {slot}
          </Text>
          <Text
            style={[textStyle('label', '500'), { color: row.status === 'failed' ? colors.danger : colors.muted }]}
            numberOfLines={2}
          >
            {status}
          </Text>
        </View>
      </Pressable>
      {action ? (
        <PillButton
          variant={action === 'finish' ? 'primary' : 'subtle'}
          label={t(`pending.${action}`)}
          accessibilityLabel={t(`pending.${action}Label`, { slot })}
          onPress={() => onAction(row)}
          testID={`pending-${action}-${row.id}`}
        />
      ) : null}
      {busy ? null : (
        <RoundIconButton
          icon="trash"
          accessibilityLabel={t('pending.discardLabel', { slot })}
          onPress={() => onDiscard(row)}
          testID={`pending-discard-${row.id}`}
        />
      )}
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
  day: { gap: space.sm },
  dayLabel: { color: colors.muted, marginHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: sizes.cardPadding,
    paddingVertical: space.xs,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm + 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: sizes.roundButton },
  thumb: { width: sizes.pendingThumbWidth, aspectRatio: 3 / 4, borderRadius: radius.pendingThumb },
  names: { flex: 1, gap: 1 },
  message: { marginTop: space.xxl },
});
