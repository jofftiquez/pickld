import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { RoundIconButton } from '@/components/RoundIconButton';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import type { Greeting } from './todayGrid';

export type TodayHeaderProps = {
  /** Already formatted for the locale, e.g. "Mon, Nov 9". */
  date: string;
  greeting: Greeting;
  /** Null while signed out or loading; the greeting then has no name. */
  displayName: string | null;
  avatarUrl: string | null;
  onOpenMyDays: () => void;
};

/** Date, greeting and the "Today" title, with the My days shortcut and avatar (Main). */
export function TodayHeader({ date, greeting, displayName, avatarUrl, onOpenMyDays }: TodayHeaderProps) {
  const { t } = useTranslation();
  // Main greets by first name ("Good afternoon, Dale"), which keeps the line short.
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greetingText = firstName
    ? t(`today.greeting.${greeting}`, { name: firstName })
    : t(`today.greetingNoName.${greeting}`);
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text style={[textStyle('bodySmall', '600'), { color: colors.muted }]}>
          {t('today.subtitle', { date, greeting: greetingText })}
        </Text>
        <Text
          testID="screen-title"
          accessibilityRole="header"
          style={[textStyle('screenTitle'), { color: colors.ink }]}
        >
          {t('today.title')}
        </Text>
      </View>
      <View style={styles.actions}>
        <RoundIconButton
          icon="myDays"
          accessibilityLabel={t('today.myDays')}
          onPress={onOpenMyDays}
          testID="today-my-days"
        />
        {/* TODO(M3-13): open My profile once the route exists. */}
        {displayName ? <Avatar name={displayName} uri={avatarUrl} size="header" testID="today-avatar" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titles: { flexShrink: 1, gap: space.xs / 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
