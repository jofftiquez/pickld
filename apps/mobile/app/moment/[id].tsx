import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJarPage } from '@/features/jar/useJarPage';
import { useLike } from '@/features/jar/useLike';
import { MomentDetailView } from '@/features/moment/MomentDetailView';
import { OwnMomentView } from '@/features/moment/OwnMomentView';
import { useOwnMoment } from '@/features/moment/useOwnMoment';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { useBlockFlow } from '@/features/safety/useBlockFlow';

// /moment/[id]: Moment detail (M3-08; FR-SOC-04) when opened from a jar (`jar` param) or for the owner's
// own live moment, swiping through that jar's shown moments. The owner's checking or removed moment
// shows its own screen (M2-21; FR-PUB-07, FR-SAF-03). Ids are validated with Zod in the hooks; a bad id
// is "not available".
export default function MomentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, jar } = useLocalSearchParams<{ id: string; jar?: string }>();
  // From a jar the moment is read through the jar page; otherwise it is the owner's own moment.
  const own = useOwnMoment(jar ? undefined : id);
  const ownLiveJar = own.kind === 'found' && own.moment.status === 'live' ? own.moment.jarId : undefined;
  const jarId = jar ?? ownLiveJar;
  const page = useJarPage(jarId);
  const like = useLike(page.data?.viewerId ?? null, page.data?.jar.id ?? null);
  const [reporting, setReporting] = useState<string | null>(null);
  const blockFlow = useBlockFlow(() => router.replace('/jars'));

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  if (jarId === undefined) return <OwnMomentView result={own} insets={insets} onClose={close} />;
  return (
    <>
      {/* Light status bar text over the dark screen. */}
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      <MomentDetailView
        data={page.data}
        failed={page.failed}
        momentId={id ?? ''}
        insets={insets}
        onClose={close}
        onToggleLike={like.toggle}
        onOpenComments={() => {
          if (page.data) router.push({ pathname: '/comments/[jarId]', params: { jarId: page.data.jar.id } });
        }}
        onShare={() => {
          if (page.data) router.push({ pathname: '/share/[jarId]', params: { jarId: page.data.jar.id } });
        }}
        onMore={setReporting}
        onRetry={() => void page.refresh()}
      />
      <ReportSheet
        visible={reporting !== null}
        subject={reporting ? { target: 'moment', targetId: reporting } : null}
        name={page.data?.author.display_name ?? ''}
        onClose={() => setReporting(null)}
        onBlock={() => {
          if (page.data) blockFlow.open({ id: page.data.jar.user_id, name: page.data.author.display_name });
        }}
      />
      {blockFlow.dialog}
    </>
  );
}
