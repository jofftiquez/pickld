import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JarPageView } from '@/features/jar/JarPageView';
import { shareJar } from '@/features/jar/shareJar';
import { useJarPage } from '@/features/jar/useJarPage';
import { useLike } from '@/features/jar/useLike';

// /jar/[id] (M3-07; FR-SOC-03, FR-JAR-06): one person's jar for one day, from a feed card or My days.
// The id is validated with Zod in useJarPage; a bad id is "not available".
export default function JarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, failed, refresh } = useJarPage(id);
  const like = useLike(data?.viewerId ?? null, data?.jar.id ?? null);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jars');
  };

  return (
    <JarPageView
      data={data}
      failed={failed}
      insets={insets}
      onBack={back}
      onToggleLike={like.toggle}
      onOpenMoment={(momentId) => {
        if (data) router.push({ pathname: '/moment/[id]', params: { id: momentId, jar: data.jar.id } });
      }}
      onShare={() => {
        if (data) shareJar(data, t);
      }}
      onRetry={() => void refresh()}
    />
  );
}
