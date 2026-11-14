// Dev-only share card matrix (QA round 3, piece H): renders the share card for every layout, background,
// moment count (1–8), the one-moment card and both formats, through the same Skia snapshot as Save image, and
// writes each PNG at full size to <documents>/share-matrix/<set>/ so it can be copied off the Simulator and
// judged. Open pickld://dev/share-matrix?jar=<own jar id>&set=<folder> while signed in as the jar's owner.
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelRatio, Text, View } from 'react-native';
import { z } from 'zod';

import { jarTitle } from '@/features/jar/shareJar';
import { useJarPage } from '@/features/jar/useJarPage';
import { type CardRef, renderCardImage } from '@/features/share/shareActions';
import { buildShareCard } from '@/features/share/shareCard';
import { StoryCard, type StoryCardProps } from '@/features/share/StoryCard';
import {
  cardCaption,
  exportUnit,
  layoutsFor,
  paletteFor,
  storyBackgrounds,
  storyFormats,
  type StoryBackground,
  type StoryFormat,
} from '@/features/share/storyLayout';
import { formatDate } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, slots, space } from '@/theme/tokens';

const paramsSchema = z.object({
  jar: z.string().uuid(),
  set: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('run'),
  /** Only these backgrounds, comma separated (all by default). */
  bg: z.string().optional(),
  /** Only these formats, comma separated (both by default). */
  format: z.string().optional(),
});

type Job = { name: string; format: StoryFormat; background: StoryBackground; count: number | 'moment'; layout: number };

/**
 * Local photo links may name the Mac's Tailscale address (for a real phone); the Simulator's App Transport
 * Security only allows plain http to the local machine, and the signature doesn't cover the host.
 */
const local = (uri: string | null) => uri?.replace(/^http:\/\/[\d.]+:(\d+)\//, 'http://127.0.0.1:$1/') ?? null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ShareMatrix() {
  const search = useLocalSearchParams();
  const key = JSON.stringify(search);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the params' contents, not their identity
  const params = useMemo(() => paramsSchema.safeParse(search).data ?? null, [key]);
  const { t } = useTranslation();
  const page = useJarPage(params?.jar, { fromMoment: true }).data;
  const data = useMemo(
    () =>
      page
        ? {
            ...page,
            moments: page.moments.map((m) => ({ ...m, thumbUrl: local(m.thumbUrl), fullUrl: local(m.fullUrl) })),
          }
        : page,
    [page],
  );
  const cardRef: CardRef = useRef(null);
  const [index, setIndex] = useState(-1);
  const [status, setStatus] = useState('loading');

  const jobs = useMemo(() => {
    if (!params) return [];
    const formats = storyFormats.filter((f) => !params.format || params.format.split(',').includes(f));
    const backgrounds = storyBackgrounds.filter((b) => !params.bg || params.bg.split(',').includes(b));
    const list: Job[] = [];
    for (const format of formats) {
      for (const background of backgrounds) {
        const framed = paletteFor(background, null).card !== null;
        for (let count = 1; count <= slots.length; count++) {
          layoutsFor(count, format, { framed }).forEach((layout, i) =>
            list.push({ name: `${format}-${count}-${layout.id}-${background}`, format, background, count, layout: i }),
          );
        }
        list.push({ name: `${format}-moment-full-${background}`, format, background, count: 'moment', layout: 0 });
      }
    }
    return list;
  }, [params]);

  const job = index >= 0 ? jobs[index] : undefined;

  // Load every photo once, then start.
  useEffect(() => {
    if (!data || index !== -1) return;
    const uris = data.moments.flatMap((m) => [m.thumbUrl, m.fullUrl]).filter((u): u is string => !!u);
    void Image.prefetch(uris).then(() => {
      const dir = new Directory(Paths.document, 'share-matrix', params?.set ?? 'run');
      if (dir.exists) dir.delete();
      dir.create({ intermediates: true });
      setIndex(0);
    });
  }, [data, index, params?.set]);

  useEffect(() => {
    if (!job || !params) return;
    let cancelled = false;
    void (async () => {
      await wait(index === 0 ? 2500 : 900);
      if (cancelled) return;
      const uri = await renderCardImage(cardRef, `share-matrix-${job.name}`);
      new File(uri).move(new File(new Directory(Paths.document, 'share-matrix', params.set), `${job.name}.png`));
      setStatus(`${index + 1}/${jobs.length} ${job.name}`);
      if (index + 1 === jobs.length) {
        new File(new Directory(Paths.document, 'share-matrix', params.set), 'done.txt').write(String(jobs.length));
        setStatus(`done ${jobs.length}`);
      }
      setIndex(index + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [job, index, jobs.length, params]);

  let story: StoryCardProps | null = null;
  if (data && job) {
    const inOrder = [...data.moments].sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
    const count = job.count === 'moment' ? slots.length : job.count;
    const card = buildShareCard(
      { ...data, moments: inOrder.slice(0, count), coverId: data.jar.resolved_cover_id },
      { includeCaption: true },
    );
    const moment = job.count === 'moment' ? (card.moments.find((m) => m.caption) ?? card.moments[0]!) : null;
    const framed = paletteFor(job.background, data.author.lid_color).card !== null;
    const caption = cardCaption(card, moment, true);
    const layout = layoutsFor(moment ? 1 : card.moments.length, job.format, { framed, caption })[job.layout]!;
    const date = formatDate(new Date(`${data.jar.local_date}T12:00:00Z`), 'UTC');
    story = {
      cardRef,
      card,
      moment,
      includeCaption: true,
      format: job.format,
      background: job.background,
      layout,
      lidColor: data.author.lid_color ?? null,
      title: jarTitle(data, t),
      date,
      authorName: data.author.display_name,
      tz: data.jar.tz,
      unit: exportUnit(PixelRatio.get()),
      accessibilityLabel: job.name,
    };
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60, gap: space.sm }}>
      <Text testID="share-matrix-status" style={[textStyle('caption'), { color: colors.ink, padding: space.md }]}>
        {!params ? 'jar=<uuid> is required' : data === null ? 'jar not available' : status}
      </Text>
      {story ? <StoryCard key={job?.name} {...story} /> : null}
    </View>
  );
}
