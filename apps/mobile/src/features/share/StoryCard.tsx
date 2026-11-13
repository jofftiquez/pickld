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
  paletteFor,
  safeArea,
  storyMetrics,
  type Rect,
  type StoryBackground,
  type StoryFormat,
  type StoryLayout,
} from './storyLayout';

// The wordmark pre-coloured brand green (see PromiseView).
const logo = require('../../../assets/brand/wordmark.png');
/** Cells at least this wide (exported pixels) load the full photo instead of the thumbnail. */
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
 * The shared image (T-509, D-62): the jar's moments, or one moment, placed in the chosen layout's
 * rectangles on one of five backgrounds. Moments are drawn with their filter and overlays (MomentCover),
 * cropped to fill their cell. The author row and the footer sit at the top and bottom of the safe area.
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
  const safe = safeArea(format);
  const pad = palette.card ? m.printPad : 0;
  const inner = { left: px(safe.x + pad), width: px(safe.width - 2 * pad) };
  const onLight = palette.card !== null || background === 'paper';
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
        <Image source={{ uri: blurUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={px(60)} />
      ) : null}
      {palette.scrim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} /> : null}
      {palette.card ? (
        <View style={[box(safe), { backgroundColor: palette.card, borderRadius: px(48) }]} testID="share-card-print" />
      ) : null}

      <View
        style={{
          position: 'absolute',
          ...inner,
          top: px(safe.y + pad),
          height: px(m.authorBand),
          flexDirection: 'row',
          alignItems: 'center',
          gap: px(24),
        }}
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
          <Text allowFontScaling={false} style={font('bold', 34, onLight ? colors.brandText : palette.text)}>
            {initialsOf(authorName)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text allowFontScaling={false} numberOfLines={1} style={font('bold', 40)}>
            {moment ? authorName : title}
          </Text>
          {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
          <Text allowFontScaling={false} numberOfLines={1} style={[font('medium', 30), { opacity: 0.85 }]}>
            {moment ? date : t('share.subtitle', { date, count, max: slots.length })}
          </Text>
        </View>
      </View>

      {shown.map((item, i) => {
        const cell = layout.cells[i];
        if (!cell) return null;
        const uri = cell.width >= FULL_PHOTO_WIDTH ? (item.fullUrl ?? item.thumbUrl) : item.thumbUrl;
        return (
          <View
            key={item.id}
            style={[
              box(cell),
              {
                borderRadius: px(cell.width >= FULL_PHOTO_WIDTH ? 32 : 20),
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
        style={{
          position: 'absolute',
          ...inner,
          bottom: px(size.height - safe.y - safe.height + pad),
          gap: px(m.captionGap),
        }}
        testID="share-card-footer"
      >
        <View
          style={{
            height: px(m.logoWidth / m.logoAspect),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: px(24),
          }}
        >
          {moment ? (
            <View
              style={{
                paddingHorizontal: px(24),
                paddingVertical: px(8),
                borderRadius: px(32),
                backgroundColor: onLight ? colors.brandTint : colors.onDarkControl,
              }}
            >
              {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
              <Text allowFontScaling={false} style={font('bold', 30, onLight ? colors.brandText : palette.text)}>
                {t(`slots.${moment.slot}`)}
              </Text>
            </View>
          ) : (
            // a11y-fixed-size: drawn into the shared image at the image's scale
            <Text allowFontScaling={false} style={font('semibold', 30)}>
              {card.link}
            </Text>
          )}
          <Image
            source={logo}
            style={{ width: px(m.logoWidth), height: px(m.logoWidth / m.logoAspect) }}
            contentFit="contain"
            tintColor={palette.logoTint ?? undefined}
            accessible={false}
          />
        </View>
        {caption ? (
          // a11y-fixed-size: drawn into the shared image at the image's scale
          <Text
            allowFontScaling={false}
            numberOfLines={m.captionLines}
            style={font('medium', m.captionSize)}
            testID="share-caption"
          >
            {t('share.caption', { caption })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
