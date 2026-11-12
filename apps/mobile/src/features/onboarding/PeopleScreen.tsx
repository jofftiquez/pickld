import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { emptyPeople, toggleAnswer, type PeopleAnswers } from './peopleModel';
import { PeopleView } from './PeopleView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

/** Your people: answers go to the owner-only onboarding_answers row; Skip saves nothing and moves on. */
export function PeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [answers, setAnswers] = useState<PeopleAnswers>(emptyPeople);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const moveOn = async () => {
    if (!userId) return;
    const next = nextSetupRoute('/setup/people');
    await saveSetupStep(userId, next);
    if (next) router.push(next);
    else router.replace('/');
  };

  const onContinue = async () => {
    if (!userId) return;
    setBusy(true);
    setFailed(false);
    try {
      const { error } = await getSupabase()
        .from('onboarding_answers')
        .upsert({ user_id: userId, ...answers });
      if (error) throw error;
      await moveOn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PeopleView
      insets={insets}
      answers={answers}
      busy={busy}
      failed={failed}
      onToggle={(group, key) => setAnswers((a) => toggleAnswer(a, group, key))}
      onContinue={() => void onContinue()}
      onSkip={() => void moveOn()}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
