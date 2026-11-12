import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WelcomeView } from '@/features/onboarding/WelcomeView';
import { track } from '@/lib/analytics';

export default function WelcomeRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <WelcomeView
      insets={insets}
      onGetStarted={() => {
        track('signup_step_completed', { step: 'welcome' });
        router.push('/intro/1');
      }}
      onSignIn={() => router.push('/sign-in')}
    />
  );
}
