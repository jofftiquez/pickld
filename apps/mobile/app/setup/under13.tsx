import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Under13View } from '@/features/onboarding/Under13View';
import { resetTo } from '@/lib/navigation';

// Under 13: the account was already purged and this phone signed out (AboutScreen).
export default function Under13Route() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <Under13View insets={insets} onBackToStart={() => resetTo(router, '/welcome')} />;
}
