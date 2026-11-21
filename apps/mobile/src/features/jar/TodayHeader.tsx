import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { RoundIconButton } from '@/components/RoundIconButton';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import type { Greeting } from './todayGrid';

export type TodayHeaderProps = {
  /** Already formatted for the locale, e.g. "Mon, Nov 9". */
  date: string;
  greeting: Greeting;
  /** Null while signed out or loading; the greeting then has no name. */
  displayName: string | null;
  avatarUrl: string | null;
  /** Left out, the calendar button is hidden. */
  onOpenMyDays?: () => void;
  /** Opens the Stickers page (D-61); missing hides the button. */
  onOpenStickers?: () => void;
  /** Pending uploads (FR-CAP-04): moments still on this phone. The button shows only when the count is above 0. */
  pendingCount?: number;
  onOpenPending?: () => void;
  /** Opens Notifications (FR-NOT-03); missing hides the bell. */
  onOpenNotifications?: () => void;
  /** Unread notifications: shows the dot on the bell. */
  hasUnread?: boolean;
  /** Opens My profile from the avatar. */
  onOpenProfile?: () => void;
  /** "Tokyo time" on a jar that started in a new zone; replaces the greeting (TimeZone). */
  zoneTag?: string | null;
  /** Previous day / Next day (`DayStepper`), at the end of the date line. */
  stepper?: ReactNode;
};

/** Date, greeting and the "Today" title, with the Stickers and My days shortcuts and avatar (Main). */
export function TodayHeader({
  date,
  greeting,
  displayName,
  avatarUrl,
  onOpenMyDays,
  onOpenStickers,
  onOpenPending,
  pendingCount = 0,
  onOpenNotifications,
  hasUnread = false,
  onOpenProfile,
  zoneTag = null,
  stepper = null,
}: TodayHeaderProps) {
  const { t } = useTranslation();
  // Main greets by first name ("Good afternoon, Dale"), which keeps the line short.
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greetingText = firstName
    ? t(`today.greeting.${greeting}`, { name: firstName })
    : t(`today.greetingNoName.${greeting}`);
  const showsPending = onOpenPending !== undefined && pendingCount > 0;
  return (
    // The date and greeting run the full width above the title row, so the round buttons sit beside "Today"
    // alone and the line wraps only at large text sizes.
    <View style={styles.header}>
      {/* The date stays muted; the greeting (or the zone tag) is in ink so the line reads first. */}
      {/* The day arrows sit at the end of this line, above the round buttons, so the title row keeps its room. */}
      <View style={styles.metaRow}>
        <Text style={[textStyle('cardTitle', '600'), styles.meta]} testID="today-subtitle">
          <Trans
            t={t}
            i18nKey={zoneTag ? 'timeZone.subtitle' : 'today.subtitle'}
            values={zoneTag ? { date, tag: zoneTag } : { date, greeting: greetingText }}
            components={{ bold: <Text style={[textStyle('cardTitle', '700'), { color: colors.ink }]} /> }}
          />
        </Text>
        {stepper}
      </View>
      <View style={styles.row}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          // On a narrow phone with every button showing, "Today" shrinks a little instead of being cut off.
          numberOfLines={1}
          adjustsFontSizeToFit
          testID="screen-title"
          accessibilityRole="header"
          style={[textStyle('screenTitle'), styles.title]}
        >
          {t('today.title')}
        </Text>
        {/* With Pending showing there are five; they close up so "Today" keeps its size on a 393 pt phone. */}
        <View style={[styles.actions, showsPending && styles.actionsTight]}>
          {showsPending ? (
            <View>
              <RoundIconButton
                icon="clock"
                accessibilityLabel={t('today.pendingLabel', { count: pendingCount })}
                onPress={onOpenPending}
                testID="today-pending"
              />
              <View style={styles.badge} pointerEvents="none" importantForAccessibility="no-hide-descendants">
                {/* a11y-fixed-size: a count on a fixed-size button; the button's label speaks it */}
                <Text
                  maxFontSizeMultiplier={1}
                  style={[textStyle('caption', '700'), styles.badgeText]}
                  testID="today-pending-count"
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Text>
              </View>
            </View>
          ) : null}
          {onOpenNotifications ? (
            <View>
              <RoundIconButton
                icon="bell"
                accessibilityLabel={hasUnread ? t('feed.notificationsUnread') : t('feed.notifications')}
                onPress={onOpenNotifications}
                testID="today-notifications"
              />
              {hasUnread ? <View style={styles.dot} pointerEvents="none" testID="today-notifications-dot" /> : null}
            </View>
          ) : null}
          {onOpenStickers ? (
            <RoundIconButton
              icon="stickers"
              accessibilityLabel={t('today.stickers')}
              onPress={onOpenStickers}
              testID="today-stickers"
            />
          ) : null}
          {onOpenMyDays ? (
            <RoundIconButton
              icon="myDays"
              accessibilityLabel={t('today.myDays')}
              onPress={onOpenMyDays}
              testID="today-my-days"
            />
          ) : null}
          {displayName && onOpenProfile ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={displayName}
              accessibilityHint={t('profile.openMine')}
              onPress={onOpenProfile}
              testID="today-avatar"
            >
              <Avatar name={displayName} uri={avatarUrl} size="header" decorative />
            </Pressable>
          ) : displayName ? (
            <Avatar name={displayName} uri={avatarUrl} size="header" testID="today-avatar" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: sizes.todayMetaGap },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flex: 1, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { color: colors.ink, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actionsTight: { gap: space.xs },
  // The unread dot on the bell, as it was on the Jars and Moments headers (Feed).
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: sizes.notifyDot + 4,
    height: sizes.notifyDot + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.notifyDot,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  // The count sits over the button's top-right edge, white on red (6.5:1).
  badge: {
    position: 'absolute',
    top: -space.xs,
    right: -space.xs,
    minWidth: sizes.pendingBadge,
    height: sizes.pendingBadge,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.surface, lineHeight: sizes.pendingBadge },
});
