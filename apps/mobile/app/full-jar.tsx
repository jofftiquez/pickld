import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { FullJarView } from '@/features/jar/FullJarView';
import { fullJarParams } from '@/features/jar/useCelebrations';
import { phoneTimeZone, todayQueryKeys, type Me, type TodayJar } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { localDateIn } from '@/lib/jars';
import { useReduceMotion } from '@/lib/useReduceMotion';

// /full-jar (M2-28, M3-01; FR-JAR-07, FR-PUB-01): the Full jar celebration, a transparent modal over Today. Today opens it
// once per jar (useCelebrations); params are validated with Zod and a bad link goes to Today.
export default function FullJarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reduceMotion = useReduceMotion();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const lidColor = queryClient.getQueryData<Me>(todayQueryKeys.me(userId ?? ''))?.lidColor;
  // Today's cached jar says whether it's still unpublished: then Publish jar opens the review (M3-01).
  const today = queryClient.getQueryData<TodayJar>(
    todayQueryKeys.jar(userId ?? '', localDateIn(new Date(), phoneTimeZone())),
  )?.jar;
  const parsed = fullJarParams.safeParse(params);
  if (!parsed.success) return <Redirect href="/today" />;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };
  return (
    <FullJarView
      localDate={parsed.data.localDate}
      jarNumber={parsed.data.number ?? null}
      lidColor={lidColor}
      reduceMotion={reduceMotion}
      onDone={close}
      onPublish={
        today && today.localDate === parsed.data.localDate && !today.publishedAt
          ? () => router.replace('/publish')
          : undefined
      }
    />
  );
}
