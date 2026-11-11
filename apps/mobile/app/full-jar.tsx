import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { FullJarView } from '@/features/jar/FullJarView';
import { fullJarParams } from '@/features/jar/useCelebrations';
import { todayQueryKeys, type Me } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { useReduceMotion } from '@/lib/useReduceMotion';

// /full-jar (M2-28; FR-JAR-07): the Full jar celebration, a transparent modal over Today. Today opens it
// once per jar (useCelebrations); params are validated with Zod and a bad link goes to Today.
export default function FullJarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reduceMotion = useReduceMotion();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const lidColor = useQueryClient().getQueryData<Me>(todayQueryKeys.me(userId ?? ''))?.lidColor;
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
    />
  );
}
