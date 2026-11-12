import { useLocalSearchParams } from 'expo-router';

import { ShareCardScreen } from '@/features/share/ShareCardScreen';

// /share/[jarId] (M4-11; FR-SOC-10): the Share jar card. The id is validated with Zod in useJarPage.
export default function ShareRoute() {
  const { jarId } = useLocalSearchParams<{ jarId: string }>();
  return <ShareCardScreen jarId={jarId} />;
}
