import { useLocalSearchParams } from 'expo-router';

import { ShareCardScreen } from '@/features/share/ShareCardScreen';

// /share/[jarId]?moment=<id> (M4-11, T-509; FR-SOC-10): share the jar, or one of its moments. The jar id is
// validated with Zod in useJarPage; the moment id only selects a moment the viewer can already see. Only the
// jar's owner gets a card (D-83); ShareCardScreen refuses anyone else.
export default function ShareRoute() {
  const { jarId, moment } = useLocalSearchParams<{ jarId: string; moment?: string }>();
  return <ShareCardScreen jarId={jarId} momentId={typeof moment === 'string' ? moment : undefined} />;
}
