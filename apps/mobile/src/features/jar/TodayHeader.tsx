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
  /** Opens My profile from the avatar. */
  onOpenProfile?: () => void;
  /** "Tokyo time" on a jar that started in a new zone; replaces the greeting (TimeZone). */
  zoneTag?: string | null;
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
  onOpenProfile,
  zoneTag = null,
}: TodayHeaderProps) {
  const { t } = useTranslation();
  // Main greets by first name ("Good afternoon, Dale"), which keeps the line short.
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greetingText = firstName
    ? t(`today.greeting.${greeting}`, { name: firstName })
    : t(`today.greetingNoName.${greeting}`);
  return (
    // The date and greeting run the full width above the title row, so the round buttons sit beside "Today"
    // alone and the line wraps only at large text sizes.
    <View style={styles.header}>
      {/* The date stays muted; the greeting (or the zone tag) is in ink so the line reads first. */}
      <Text style={[textStyle('cardTitle', '600'), { color: colors.muted }]} testID="today-subtitle">
        <Trans
          t={t}
          i18nKey={zoneTag ? 'timeZone.subtitle' : 'today.subtitle'}
          values={zoneTag ? { date, tag: zoneTag } : { date, greeting: greetingText }}
          components={{ bold: <Text style={[textStyle('cardTitle', '700'), { color: colors.ink }]} /> }}
        />
      </Text>
      <View style={styles.row}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          testID="screen-title"
          accessibilityRole="header"
          style={[textStyle('screenTitle'), styles.title]}
        >
          {t('today.title')}
        </Text>
        <View style={styles.actions}>
          {onOpenPending && pendingCount > 0 ? (
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { color: colors.ink, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
