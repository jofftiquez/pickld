import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { deviceLocale } from '@/lib/format';
import type { DaySlot } from '@/lib/jars';
import { useLargeText } from '@/lib/useLargeText';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { NotificationRow } from './NotificationRow';
import {
  ageLabel,
  buildSections,
  targetOf,
  type NotificationEntry,
  type NotificationTarget,
} from './notificationsModel';
import type { NotificationsData } from './useNotifications';

export type NotificationsViewProps = {
  /** Undefined while the first load runs. */
  data: NotificationsData | undefined;
  failed?: boolean;
  isRefreshing?: boolean;
  /** The current day slot while it is still empty: the pinned reminder card. */
  reminderSlot: Extract<DaySlot, 'morning' | 'afternoon' | 'evening'> | null;
  now: Date;
  tz: string;
  insets: EdgeInsets;
  onClose: () => void;
  onRefresh: () => void;
  onCapture: (slot: DaySlot) => void;
  onOpen: (target: NotificationTarget) => void;
  onFollow: (entry: NotificationEntry) => void;
  locale?: string;
};

/**
 * Notifications (FR-NOT-03): a pinned reminder while the current slot is empty, then Today, This week and
 * Earlier. Likes on the same jar or moment are one row; tapping a row opens what it is about.
 */
export function NotificationsView({
  data,
  failed = false,
  isRefreshing = false,
  reminderSlot,
  now,
  tz,
  insets,
  onClose,
  onRefresh,
  onCapture,
  onOpen,
  onFollow,
  locale = deviceLocale(),
}: NotificationsViewProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const sections = data ? buildSections(data.rows, now, tz) : [];
  const reading = new Set(data?.reading ?? []);

  const ageText = (createdAt: string) => {
    const age = ageLabel(createdAt, now, tz, locale);
    return age.kind === 'date' ? age.text : t(`notifications.age.${age.kind}`, { count: age.count });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="notifications-screen">
      <View style={styles.header}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('screenTitle'), { color: colors.ink }]}
        >
          {t('notifications.title')}
        </Text>
        <RoundIconButton
          icon="close"
          accessibilityLabel={t('notifications.close')}
          onPress={onClose}
          testID="notifications-close"
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {reminderSlot ? (
          <View style={[styles.reminder, large && styles.reminderWrap]} testID="notifications-reminder">
            <View style={styles.reminderIcon}>
              <Icon name={reminderSlot} color="surface" size={20} />
            </View>
            <View style={[styles.reminderText, large && styles.reminderTextLarge]}>
              <Text style={[textStyle('body', '700'), { color: colors.surface }]}>
                {t(`reminders.${reminderSlot}.0.title`)}
              </Text>
              <Text style={[textStyle('label', '500'), { color: colors.onDarkMuted }]}>
                {t(`notifications.reminderBody.${reminderSlot}`)}
              </Text>
            </View>
            <PillButton
              label={t('notifications.capture')}
              accessibilityLabel={t('notifications.captureA11y', { slot: t(`slots.${reminderSlot}`) })}
              onPress={() => onCapture(reminderSlot)}
              testID="notifications-capture"
            />
          </View>
        ) : null}
        {data === undefined && failed ? (
          <View style={styles.message}>
            <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('notifications.failed')}</Text>
            <SecondaryButton label={t('notifications.retry')} onPress={onRefresh} testID="notifications-retry" />
          </View>
        ) : data === undefined ? (
          <ActivityIndicator color={colors.muted} style={styles.message} testID="notifications-loading" />
        ) : sections.length === 0 ? (
          <EmptyState
            illustration="bell"
            title={t('notifications.emptyTitle')}
            body={t('notifications.empty')}
            refreshable
            testID="notifications-empty"
          />
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section} testID={`notifications-${section.key}`}>
              <Text accessibilityRole="header" style={[textStyle('bodyMedium', '700'), styles.sectionTitle]}>
                {t(`notifications.${section.key}`)}
              </Text>
              <View style={styles.card}>
                {section.entries.map((entry, i) => {
                  const actor = entry.actors[0];
                  const social =
                    entry.type === 'new_reader' || entry.type === 'friend_joined' || entry.type === 'invite_joined';
                  // Likes, comments and replies show the photo they are about (the jar's first one for the whole jar).
                  const photo = entry.type === 'like' || entry.type === 'comment' || entry.type === 'reply';
                  const momentId = photo
                    ? (entry.momentId ?? (entry.jarId ? data.jarMoment[entry.jarId] : undefined))
                    : undefined;
                  const target = targetOf(entry);
                  return (
                    <NotificationRow
                      key={entry.key}
                      entry={entry}
                      age={ageText(entry.createdAt)}
                      avatarUrl={actor ? (data.avatars[actor.id] ?? null) : null}
                      thumbUrl={momentId ? (data.thumbs[momentId] ?? null) : null}
                      follow={
                        social && actor && !reading.has(actor.id)
                          ? entry.type === 'new_reader'
                            ? 'readBack'
                            : 'read'
                          : null
                      }
                      divider={i < section.entries.length - 1}
                      onOpen={target ? () => onOpen(target) : null}
                      onFollow={() => onFollow(entry)}
                      locale={locale}
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}
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
    paddingHorizontal: space.xl,
    paddingTop: sizes.headerTop,
    paddingBottom: space.md,
  },
  content: { paddingHorizontal: space.xl, gap: space.sm + 2 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: sizes.cardPadding,
    borderRadius: radius.reminderCard,
    backgroundColor: colors.ink,
  },
  reminderIcon: {
    width: sizes.notifyReminderIcon,
    height: sizes.notifyReminderIcon,
    borderRadius: radius.notifyIcon,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: { flex: 1, gap: 2 },
  // Large text: Capture wraps below, so the reminder keeps the card's width.
  reminderWrap: { flexWrap: 'wrap', rowGap: space.md },
  reminderTextLarge: { flexBasis: '70%' },
  section: { gap: space.sm + 2 },
  sectionTitle: { color: colors.muted, marginTop: space.sm, marginHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: sizes.cardPadding,
    paddingVertical: 2,
    ...shadow.card,
  },
  message: { marginTop: space.xxl, gap: space.md },
  center: { textAlign: 'center' },
});
