import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JarPageView, jarTitle } from '@/features/jar/JarPageView';
import { useJarPage } from '@/features/jar/useJarPage';
import { jarUrl } from '@/lib/links';

// /jar/[id] (M3-07; FR-SOC-03, FR-JAR-06): one person's jar for one day, from a feed card or My days.
// The id is validated with Zod in useJarPage; a bad id is "not available".
export default function JarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, failed, refresh } = useJarPage(id);

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
      // TODO(M4-11, #101): open the Share jar card; until then share the jar's link.
      onShare={() => {
        if (data)
          void Share.share({
            message: t('jarPage.shareMessage', { title: jarTitle(data, t), url: jarUrl(data.jar.id) }),
          });
      }}
      onRetry={() => void refresh()}
    />
  );
}
