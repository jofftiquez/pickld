import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WelcomeView } from '@/features/onboarding/WelcomeView';

export default function WelcomeRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <WelcomeView
      insets={insets}
      onGetStarted={() => router.push('/intro/1')}
      onSignIn={() => router.push('/sign-in')}
    />
  );
}
