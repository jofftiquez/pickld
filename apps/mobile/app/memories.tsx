import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { phoneTimeZone } from '@/features/jar/useToday';
import { MemoriesView } from '@/features/memories/MemoriesView';
import { useMemories } from '@/features/memories/useMemories';
import { localDateIn } from '@/lib/jars';

// /memories (M6-06; FR-DAY-03): On this day, last month's recap and the year so far, opened from My days.
export default function MemoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = localDateIn(new Date(), phoneTimeZone());
  const { data, isError, refetch } = useMemories(today);
  const openJar = (id: string) => router.push({ pathname: '/jar/[id]', params: { id } });
  return (
    <MemoriesView
      data={data}
      failed={isError}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/my-days'))}
      onRetry={() => void refetch()}
      onOpenJar={openJar}
      onOpenPhoto={(photo) =>
        router.push({ pathname: '/moment/[id]', params: { id: photo.momentId, jar: photo.jarId } })
      }
      onYear={() => router.replace('/my-days')}
    />
  );
}
