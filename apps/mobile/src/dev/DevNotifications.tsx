// Dev-only notification tools for Simulator checks of M3-18 until the Permissions screen lands (M4-07):
// asks for notification permission, lists the scheduled slot reminders, and fires one reminder 5 seconds
// out so the banner can be captured. Copy is inline like the dev Gallery; none of this ships.
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { REMINDER_ID_PREFIX } from '@/features/reminders/reminderPlan';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

type Row = { id: string; title: string; at: string };

export function DevNotifications() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ['devNotifications'],
    queryFn: async (): Promise<{ status: string; rows: Row[] }> => {
      const { status } = await Notifications.getPermissionsAsync();
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const rows = all
        .filter((n) => n.identifier.startsWith(REMINDER_ID_PREFIX))
        .map((n) => {
          const trigger = n.trigger as { value?: number; date?: number } | null;
          const at = trigger?.value ?? trigger?.date;
          return { id: n.identifier, title: n.content.title ?? '', at: at ? new Date(at).toLocaleString() : '?' };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      return { status, rows };
    },
    networkMode: 'always',
    staleTime: 0,
  });
  const status = query.data?.status ?? '…';
  const rows = query.data?.rows ?? [];
  const refresh = () => query.refetch();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.xl, gap: space.md }}
    >
      <Text testID="dev-notifications-status" style={[textStyle('body', '700'), { color: colors.ink }]}>
        {`Permission: ${status}`}
      </Text>
      <PrimaryButton
        label="Allow notifications"
        testID="dev-notifications-allow"
        onPress={() => void Notifications.requestPermissionsAsync().then(refresh)}
      />
      <SecondaryButton
        label="Reminder in 5 seconds"
        testID="dev-notifications-test"
        onPress={() =>
          void Notifications.scheduleNotificationAsync({
            content: {
              title: t('reminders.afternoon.0.title'),
              body: t('reminders.afternoon.0.body', { slot: t('slots.afternoon') }),
              data: { kind: 'reminder', slot: 'afternoon' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
          })
        }
      />
      <SecondaryButton label="Refresh" testID="dev-notifications-refresh" onPress={() => void refresh()} />
      <Text testID="dev-notifications-count" style={[textStyle('bodySmall', '700'), { color: colors.muted }]}>
        {`${rows.length} reminders scheduled`}
      </Text>
      {rows.map((r) => (
        <View key={r.id} testID={`dev-reminder-${r.id.slice(REMINDER_ID_PREFIX.length)}`}>
          <Text style={[textStyle('bodySmall', '700'), { color: colors.ink }]}>
            {r.id.slice(REMINDER_ID_PREFIX.length)}
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]}>{`${r.at} · ${r.title}`}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
