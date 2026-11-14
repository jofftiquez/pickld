import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { parseEdits } from '@/features/edit/edits';
import type { JarMoment } from '@/features/jar/jarPage';
import { MomentCover } from '@/features/moment/MomentCover';
import { fontFamilies } from '@/theme/fontFamilies';
import { colors, slots } from '@/theme/tokens';

import type { CardRef } from './shareActions';
import type { ShareCard } from './shareCard';
import {
  canvasSize,
  cardCaption,
  paletteFor,
  storyMetrics,
  type Rect,
  type StoryBackground,
  type StoryFormat,
  type StoryLayout,
} from './storyLayout';
import { photoSource } from '@/lib/image/photoCache';

// The wordmark pre-coloured brand green (see PromiseView).
const logo = require('../../../assets/brand/wordmark.png');
/** Cells that show the photo at least this wide (exported pixels) load the full photo, not the 480 px thumbnail. */
const FULL_PHOTO_WIDTH = 360;

export type StoryCardProps = {
  cardRef: CardRef;
  card: ShareCard;
  /** Set when sharing one moment; otherwise the card shows the jar. */
  moment: JarMoment | null;
  /** The moment's own caption (the jar's caption is already in `card`). */
  includeCaption: boolean;
  format: StoryFormat;
  background: StoryBackground;
  /** Where each photo goes (`layoutsFor`); the same rectangles the layout thumbnails draw. */
  layout: StoryLayout;
  lidColor: string | null;
  title: string;
  /** "Nov 8, 2026" */
  date: string;
  authorName: string;
  tz: string;
  /** Points per exported pixel; the card is `canvasSize(format).width * unit` points wide. */
  unit: number;
  accessibilityLabel: string;
};

/**
 * The shared image (T-509, D-62, D-90): the jar's moments, or one moment, placed in the chosen layout's
 * rectangles on one of five backgrounds. Moments are drawn whole at 3:4 with their filter and overlays
 * (MomentCover). Under the photos, never on them, sit the caption and a row with the title and date on the
 * left and the wordmark over the link on the right; the photos and the words stay inside the part of a Story
 * that Instagram's bars leave uncovered. Everything is placed in pixels of the exported image times `unit`,
 * so this one view is both the preview and the saved file; text never follows the system text size, because
 * it is part of the picture.
 */
export function StoryCard(props: StoryCardProps) {
  const { cardRef, card, moment, includeCaption, format, background, layout, lidColor, title, date, authorName } =
    props;
  const { tz, unit } = props;
  const { t } = useTranslation();
  const m = storyMetrics;
  const px = (n: number) => n * unit;
  const size = canvasSize(format);
  const palette = paletteFor(background, lidColor);
  const shown = moment ? [moment] : card.moments;
  const blurUri = shown[0]?.thumbUrl ?? null;
  const font = (family: keyof typeof fontFamilies, n: number, lineHeight: number = m.lineHeight): TextStyle => ({
    fontFamily: fontFamilies[family],
    fontSize: px(n),
    lineHeight: px(n * lineHeight),
    color: palette.text,
  });
  const count = card.moments.length;
  const caption = cardCaption(card, moment, includeCaption);
  const box = (r: Rect) => ({
    position: 'absolute' as const,
    left: px(r.x),
    top: px(r.y),
    width: px(r.width),
    height: px(r.height),
  });

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={{ width: px(size.width), height: px(size.height), backgroundColor: palette.fill, overflow: 'hidden' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={props.accessibilityLabel}
      testID="share-card"
    >
      {palette.blurred && blurUri ? (
        <Image source={photoSource(blurUri)} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={px(60)} />
      ) : null}
      {palette.scrim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} /> : null}
      {palette.card && layout.card ? (
        <View
          style={[box(layout.card), { backgroundColor: palette.card, borderRadius: px(36) }]}
          testID="share-card-print"
        />
      ) : null}

      {shown.map((item, i) => {
        const cell = layout.cells[i];
        if (!cell) return null;
        const uri = cell.width >= FULL_PHOTO_WIDTH ? (item.mediumUrl ?? item.fullUrl ?? item.thumbUrl) : item.thumbUrl;
        return (
          <View
            key={item.id}
            style={[
              box(cell),
              {
                borderRadius: px(cell.width >= FULL_PHOTO_WIDTH ? 24 : 16),
                overflow: 'hidden',
                backgroundColor: colors.tileIconWell,
              },
            ]}
            testID={`share-card-${item.slot}`}
          >
            {uri !== null ? (
              <MomentCover
                uri={uri}
                edits={parseEdits(item.edits)}
                stamp={{ capturedAt: new Date(item.captured_at ?? item.added_at), tz }}
                accessible={false}
              />
            ) : null}
          </View>
        );
      })}

      <View style={[box(layout.text), { justifyContent: 'flex-end' }]} testID="share-card-text">
        {caption && layout.captionLines > 0 ? (
          // a11y-fixed-size: drawn into the shared image at the image's scale
          <Text
            allowFontScaling={false}
            numberOfLines={layout.captionLines}
            style={[font('medium', m.captionSize), { marginBottom: px(m.captionGap) }]}
            testID="share-caption"
          >
            {t('share.caption', { caption })}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: px(24) }} testID="share-card-footer">
          <View style={{ flex: 1 }}>
            {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={font('bold', m.titleSize, m.titleLineHeight)}
              testID="share-card-title"
            >
              {moment ? authorName : title}
            </Text>
            {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
            <Text allowFontScaling={false} numberOfLines={1} style={[font('medium', m.subSize), { opacity: 0.85 }]}>
              {moment
                ? t('share.subtitleMoment', { slot: t(`slots.${moment.slot}`), date })
                : t('share.subtitle', { date, count, max: slots.length })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', flexShrink: 1, maxWidth: '50%' }}>
            <Image
              source={logo}
              style={{ width: px(m.logoWidth), height: px(m.logoWidth / m.logoAspect) }}
              contentFit="contain"
              tintColor={palette.logoTint ?? undefined}
              accessible={false}
            />
            {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
            <Text allowFontScaling={false} numberOfLines={1} style={font('semibold', m.linkSize)}>
              {card.link}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
