import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Under13View } from '@/features/onboarding/Under13View';
import { resetTo } from '@/lib/navigation';

// Under 13: the account was already purged and this phone signed out (AboutScreen). Go back starts
// over at the first How it works page, with no history back into setup (D-85).
export default function Under13Route() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <Under13View insets={insets} onBackToStart={() => resetTo(router, '/intro/1')} />;
}
