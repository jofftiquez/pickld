import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JarPageView } from '@/features/jar/JarPageView';
import { useJarPage } from '@/features/jar/useJarPage';
import { useLike } from '@/features/jar/useLike';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { useBlockFlow } from '@/features/safety/useBlockFlow';

// /jar/[id] (M3-07; FR-SOC-03, FR-JAR-06): one person's jar for one day, from a feed card or My days.
// The id is validated with Zod in useJarPage; a bad id is "not available".
export default function JarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, failed, refresh } = useJarPage(id);
  const like = useLike(data?.viewerId ?? null, data?.jar.id ?? null);
  const [reporting, setReporting] = useState(false);
  const blockFlow = useBlockFlow(() => router.replace('/jars'));

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jars');
  };

  return (
    <>
      <JarPageView
        data={data}
        failed={failed}
        insets={insets}
        onBack={back}
        onToggleLike={like.toggle}
        onOpenComments={() => {
          if (data) router.push({ pathname: '/comments/[jarId]', params: { jarId: data.jar.id } });
        }}
        onOpenMoment={(momentId) => {
          if (data) router.push({ pathname: '/moment/[id]', params: { id: momentId, jar: data.jar.id } });
        }}
        onOpenAuthor={() => {
          if (data) router.push({ pathname: '/u/[username]', params: { username: data.author.username } });
        }}
        onShare={() => {
          // Only the owner shares (D-83); the view offers Share on their own jar only.
          if (data && data.jar.user_id === data.viewerId)
            router.push({ pathname: '/share/[jarId]', params: { jarId: data.jar.id } });
        }}
        onMore={() => setReporting(true)}
        onRetry={() => void refresh()}
      />
      <ReportSheet
        visible={reporting}
        subject={data ? { target: 'jar', targetId: data.jar.id } : null}
        name={data?.author.display_name ?? ''}
        onClose={() => setReporting(false)}
        onBlock={() => {
          if (data) blockFlow.open({ id: data.jar.user_id, name: data.author.display_name });
        }}
      />
      {blockFlow.dialog}
    </>
  );
}
