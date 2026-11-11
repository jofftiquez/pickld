import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnMomentView } from '@/features/moment/OwnMomentView';
import { useOwnMoment } from '@/features/moment/useOwnMoment';

// /moment/[id] (M2-21; FR-PUB-07, FR-SAF-03): the owner's own moment while it is checked or after it
// was removed. The id is validated with Zod in useOwnMoment; a bad id is "not found".
export default function MomentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useOwnMoment(id);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  return <OwnMomentView result={result} insets={insets} onClose={close} />;
}
