import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { INTRO_STEPS, IntroView } from '@/features/onboarding/IntroView';

const stepSchema = z.coerce.number().int().min(1).max(INTRO_STEPS);

// How it works, pages 1–3. Skip on any page, and Create my account on the last, go to Sign up.
export default function IntroRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const parsed = stepSchema.safeParse(useLocalSearchParams<{ step: string }>().step);
  if (!parsed.success) return <Redirect href="/welcome" />;
  const step = parsed.data as 1 | 2 | 3;
  return (
    <IntroView
      step={step}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      onSignUp={() => router.push('/sign-up')}
      onNext={() => router.push({ pathname: '/intro/[step]', params: { step: String(step + 1) } })}
    />
  );
}
