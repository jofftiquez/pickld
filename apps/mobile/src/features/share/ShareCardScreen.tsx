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
import { showToast } from '@/lib/toast';
import { textStyle } from '@/theme/text';
import { colors, slots, space } from '@/theme/tokens';

import { type CardRef, copyLink, messageLink, renderCardImage, saveImage, shareImage } from './shareActions';
import { buildShareCard } from './shareCard';
import { ShareCardView, type ShareAction } from './ShareCardView';
import {
  cardCaption,
  layoutsFor,
  paletteFor,
  shareableMoment,
  type StoryBackground,
  type StoryFormat,
  type StoryLayoutId,
} from './storyLayout';

/**
 * Share a jar, or one moment of it when `momentId` is set (FR-SOC-10, T-509). Reads the jar as the viewer,
 * so RLS and the card model both filter; a private, checking or removed moment can't be shared.
 */
export function ShareCardScreen({ jarId, momentId }: { jarId: string | undefined; momentId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useJarPage(jarId);
  const cardRef: CardRef = useRef(null);
  const [includeCaption, setIncludeCaption] = useState(true);
  const [format, setFormat] = useState<StoryFormat>('story');
  const [background, setBackground] = useState<StoryBackground>('blur');
  // The picked layout, for the number of moments it was picked for: a new count starts on its default.
  const [picked, setPicked] = useState<{ count: number; id: StoryLayoutId } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/jars'));

  const moment = data && momentId !== undefined ? shareableMoment(data.moments, momentId) : null;
  if (!data || (momentId !== undefined && !moment)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.camera, justifyContent: 'center', padding: space.xxl }}>
        {data !== undefined ? (
          <Text style={[textStyle('body'), { color: colors.surface, textAlign: 'center' }]}>
            {t(data === null ? 'share.unavailable' : 'share.unavailableMoment')}
          </Text>
        ) : null}
      </View>
    );
  }

  const card = buildShareCard(data, { includeCaption });
  const title = jarTitle(data, t);
  const linkText = t('share.linkMessage', { title, url: jarUrl(data.jar.id) });
  const heading = t(moment ? 'share.titleMoment' : 'share.title');
  const fileName = moment ? `pickld-moment-${moment.id}` : `pickld-jar-${data.jar.id}`;
  const date = formatDate(new Date(`${data.jar.local_date}T12:00:00Z`), 'UTC');
  // One moment alone always uses the single full layout.
  const count = moment ? 1 : card.moments.length;
  const layouts = layoutsFor(count, format, {
    framed: paletteFor(background, data.author.lid_color).card !== null,
    caption: cardCaption(card, moment, includeCaption) !== null,
  });
  const layout = layouts.find((l) => picked?.count === count && l.id === picked.id) ?? layouts[0]!;

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
          const uri = await renderCardImage(cardRef, fileName);
          if ((await saveImage(uri)) === 'denied') return { text: t('share.saveDenied'), error: true };
          track('share_card_exported', { destination: 'save' });
          showToast('imageSaved');
          return null;
        }
        case 'copy':
          await copyLink(jarUrl(data.jar.id));
          showToast('linkCopied');
          return null;
        case 'message':
          await messageLink(linkText);
          return null;
      }
    });

  return (
    <ShareCardView
      insets={insets}
      heading={heading}
      story={{
        cardRef,
        card,
        moment,
        includeCaption,
        format,
        background,
        layout,
        lidColor: data.author.lid_color ?? null,
        title,
        date,
        authorName: data.author.display_name,
        tz: data.jar.tz,
        accessibilityLabel: moment
          ? t('share.cardMoment', { name: data.author.display_name, slot: t(`slots.${moment.slot}`), date })
          : t('share.card', { title, date, count: card.moments.length, max: slots.length }),
      }}
      layouts={layouts}
      onLayout={(id) => setPicked({ count, id })}
      onFormat={setFormat}
      onBackground={setBackground}
      includeCaption={includeCaption}
      notice={notice}
      busy={busy}
      onToggleCaption={setIncludeCaption}
      onAction={onAction}
      onShareTo={() =>
        void run(async () => {
          await shareImage(await renderCardImage(cardRef, fileName), heading);
          track('share_card_exported', { destination: 'share' });
          return null;
        })
      }
      onBack={back}
    />
  );
}
