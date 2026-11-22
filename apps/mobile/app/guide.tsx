import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { GUIDE_PAGES } from '@/features/guide/GuideArt';
import { GuideView } from '@/features/guide/GuideView';
import { track } from '@/lib/analytics';

const fromSchema = z.enum(['first_tip', 'help', 'settings']).catch('help');

// How Pickld works (FR-ONB-10): five pages on one route, opened by choice. Back steps a page; Done closes it.
export default function GuideRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const from = fromSchema.parse(useLocalSearchParams<{ from?: string }>().from);
  const [page, setPage] = useState(1);
  useEffect(() => {
    track('guide_opened', { from });
  }, [from]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/today'));
  return (
    <GuideView
      page={page}
      insets={insets}
      onBack={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => Math.min(GUIDE_PAGES, p + 1))}
      onDone={close}
    />
  );
}
