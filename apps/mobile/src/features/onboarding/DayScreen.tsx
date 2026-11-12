import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reminderQueryKeys } from '@/features/reminders/useReminderSync';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { DAY_PRESETS, toLocalTime, type DayTimes, type DayType } from './dayPresets';
import { DayView } from './DayView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

/** Your day: saves the day type (onboarding_answers) and the three times (reminder_settings), then moves on. */
export function DayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  // Coffee first is the middle choice and starts selected, as in the design.
  const [dayType, setDayType] = useState<DayType>('coffee_first');
  const [times, setTimes] = useState<DayTimes>(DAY_PRESETS.coffee_first);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const onContinue = async () => {
    if (!userId) return;
    setBusy(true);
    setFailed(false);
    try {
      const supabase = getSupabase();
      const answers = await supabase.from('onboarding_answers').upsert({ user_id: userId, day_type: dayType });
      if (answers.error) throw answers.error;
      const reminders = await supabase.from('reminder_settings').upsert(
        (['morning', 'afternoon', 'evening'] as const).map((slot) => ({
          user_id: userId,
          slot,
          local_time: toLocalTime(times[slot]),
          enabled: true,
        })),
      );
      if (reminders.error) throw reminders.error;
      void queryClient.invalidateQueries({ queryKey: reminderQueryKeys.settings(userId) });
      track('signup_step_completed', { step: 'day' });
      const next = nextSetupRoute('/setup/day');
      await saveSetupStep(userId, next);
      if (next) router.push(next);
      else router.replace('/');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DayView
      insets={insets}
      dayType={dayType}
      times={times}
      busy={busy}
      failed={failed}
      onPick={(type) => {
        setDayType(type);
        setTimes(DAY_PRESETS[type]);
      }}
      onChangeTime={(slot, minutes) => setTimes((t) => ({ ...t, [slot]: minutes }))}
      onContinue={() => void onContinue()}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
