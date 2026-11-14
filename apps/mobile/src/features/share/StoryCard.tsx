import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { initialsOf } from '@/components/Avatar';
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
  frameArea,
  overlayRects,
  paletteFor,
  storyMetrics,
  type Rect,
  type StoryBackground,
  type StoryFormat,
  type StoryLayout,
} from './storyLayout';

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
 * The shared image (T-509, D-62, D-82): the jar's moments, or one moment, placed in the chosen layout's
 * rectangles on one of five backgrounds. Moments are drawn with their filter and overlays (MomentCover),
 * cropped to fill their cell. The photos fill the card; the author pill, the caption band and the footer
 * row sit over them on pills, inside the safe area that a Story's bars leave uncovered.
 * Everything is placed in pixels of the exported image times `unit`, so this one view is both the preview
 * and the saved file; text never follows the system text size, because it is part of the picture.
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
  const font = (family: keyof typeof fontFamilies, n: number, color = palette.text): TextStyle => ({
    fontFamily: fontFamilies[family],
    fontSize: px(n),
    lineHeight: px(n * 1.3),
    color,
  });
  const count = card.moments.length;
  const caption = cardCaption(card, moment, includeCaption);
  const overlays = overlayRects(format);
  const onLight = palette.pill === colors.surface;
  const box = (r: Rect) => ({
    position: 'absolute' as const,
    left: px(r.x),
    top: px(r.y),
    width: px(r.width),
    height: px(r.height),
  });
  /** A pill hugging its content, anchored at the left of `r`, never wider than it. */
  const pill = (r: Rect, height: number) => ({
    position: 'absolute' as const,
    left: px(r.x),
    top: px(r.y),
    maxWidth: px(r.width),
    height: px(height),
    borderRadius: px(height / 2),
    backgroundColor: palette.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
        <Image source={{ uri: blurUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={px(60)} />
      ) : null}
      {palette.scrim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} /> : null}
      {palette.card ? (
        <View
          style={[box(frameArea(format)), { backgroundColor: palette.card, borderRadius: px(40) }]}
          testID="share-card-print"
        />
      ) : null}

      {shown.map((item, i) => {
        const cell = layout.cells[i];
        if (!cell) return null;
        // A cell stretched taller than 3:4 crops the photo's sides, so it shows the photo at its height's width.
        const photoWidth = Math.max(cell.width, (cell.height * 3) / 4);
        const uri = photoWidth >= FULL_PHOTO_WIDTH ? (item.fullUrl ?? item.thumbUrl) : item.thumbUrl;
        return (
          <View
            key={item.id}
            style={[
              box(cell),
              {
                borderRadius: px(cell.width >= FULL_PHOTO_WIDTH ? 24 : 14),
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

      <View
        style={[
          pill(overlays.author, overlays.author.height),
          { paddingLeft: px(m.pillPad), paddingRight: px(m.pillPadX), gap: px(16) },
        ]}
        testID="share-card-author"
      >
        <View
          style={{
            width: px(m.avatar),
            height: px(m.avatar),
            borderRadius: px(m.avatar / 2),
            backgroundColor: onLight ? colors.brandTint : colors.onDarkControl,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text allowFontScaling={false} style={font('bold', 26, onLight ? colors.brandText : palette.text)}>
            {initialsOf(authorName)}
          </Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text allowFontScaling={false} numberOfLines={1} style={font('bold', m.nameSize)}>
            {moment ? authorName : title}
          </Text>
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text allowFontScaling={false} numberOfLines={1} style={[font('medium', m.dateSize), { opacity: 0.85 }]}>
            {moment ? date : t('share.subtitle', { date, count, max: slots.length })}
          </Text>
        </View>
      </View>

      {caption ? (
        <View
          style={{
            position: 'absolute',
            left: px(overlays.caption.x),
            bottom: px(size.height - overlays.caption.y - overlays.caption.height),
            maxWidth: px(overlays.caption.width),
            padding: px(m.captionPad),
            paddingHorizontal: px(m.pillPadX),
            borderRadius: px(28),
            backgroundColor: palette.pill,
          }}
          testID="share-card-caption-band"
        >
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text
            allowFontScaling={false}
            numberOfLines={m.captionLines}
            style={font('medium', m.captionSize)}
            testID="share-caption"
          >
            {t('share.caption', { caption })}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          box(overlays.footer),
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: px(16) },
        ]}
        testID="share-card-footer"
      >
        <View
          style={{
            flexShrink: 1,
            height: px(m.footerHeight),
            justifyContent: 'center',
            paddingHorizontal: px(m.pillPadX),
            borderRadius: px(m.footerHeight / 2),
            backgroundColor: palette.pill,
          }}
        >
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text allowFontScaling={false} numberOfLines={1} style={font(moment ? 'bold' : 'semibold', m.footerSize)}>
            {moment ? t(`slots.${moment.slot}`) : card.link}
          </Text>
        </View>
        <View
          style={{
            height: px(m.footerHeight),
            justifyContent: 'center',
            paddingHorizontal: px(m.pillPadX),
            borderRadius: px(m.footerHeight / 2),
            backgroundColor: palette.pill,
          }}
        >
          <Image
            source={logo}
            style={{ width: px(m.logoWidth), height: px(m.logoWidth / m.logoAspect) }}
            contentFit="contain"
            tintColor={palette.logoTint ?? undefined}
            accessible={false}
          />
        </View>
      </View>
    </View>
  );
}
