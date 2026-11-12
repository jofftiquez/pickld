import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { jarTitle } from '@/features/jar/shareJar';
import { useJarPage } from '@/features/jar/useJarPage';
import { track } from '@/lib/analytics';
import { formatDate } from '@/lib/format';
import { jarUrl } from '@/lib/links';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import { type CardRef, copyLink, messageLink, renderCardImage, saveImage, shareImage, shareLink } from './shareActions';
import { buildShareCard } from './shareCard';
import { ShareCardView, type ShareAction } from './ShareCardView';

/** Share jar for one jar (FR-SOC-10). Reads the jar as the viewer, so RLS and the card model both filter. */
export function ShareCardScreen({ jarId }: { jarId: string | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useJarPage(jarId);
  const cardRef: CardRef = useRef(null);
  const [includeCaption, setIncludeCaption] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/jars'));

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.camera, justifyContent: 'center', padding: space.xxl }}>
        {data === null ? (
          <Text style={[textStyle('body'), { color: colors.surface, textAlign: 'center' }]}>
            {t('share.unavailable')}
          </Text>
        ) : null}
      </View>
    );
  }

  const card = buildShareCard(data, { includeCaption });
  const title = jarTitle(data, t);
  const linkText = t('share.linkMessage', { title, url: jarUrl(data.jar.id) });

  type Notice = { text: string; error: boolean } | null;
  const run = async (work: () => Promise<Notice>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await work());
    } catch {
      setNotice({ text: t('share.failed'), error: true });
    } finally {
      setBusy(false);
    }
  };

  const onAction = (action: ShareAction) =>
    void run(async () => {
      switch (action) {
        case 'save': {
          const uri = await renderCardImage(cardRef, data.jar.id);
          if ((await saveImage(uri)) === 'denied') return { text: t('share.saveDenied'), error: true };
          track('share_card_exported', { destination: 'save' });
          return { text: t('share.saved'), error: false };
        }
        case 'copy':
          await copyLink(jarUrl(data.jar.id));
          return { text: t('share.copied'), error: false };
        case 'message':
          await messageLink(linkText);
          return null;
        case 'more':
          await shareLink(linkText);
          return null;
      }
    });

  return (
    <ShareCardView
      insets={insets}
      cardRef={cardRef}
      card={card}
      title={title}
      date={formatDate(new Date(`${data.jar.local_date}T12:00:00Z`), 'UTC')}
      authorName={data.author.display_name}
      tz={data.jar.tz}
      includeCaption={includeCaption}
      notice={notice}
      busy={busy}
      onToggleCaption={setIncludeCaption}
      onAction={onAction}
      onShareTo={() =>
        void run(async () => {
          await shareImage(await renderCardImage(cardRef, data.jar.id), t('share.title'));
          track('share_card_exported', { destination: 'share' });
          return null;
        })
      }
      onBack={back}
    />
  );
}
