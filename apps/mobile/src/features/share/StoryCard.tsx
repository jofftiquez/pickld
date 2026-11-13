import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { initialsOf } from '@/components/Avatar';
import { parseEdits } from '@/features/edit/edits';
import type { JarMoment } from '@/features/jar/jarPage';
import { MomentCover } from '@/features/moment/MomentCover';
import { fontFamilies } from '@/theme/fontFamilies';
import { colors, photo, slots } from '@/theme/tokens';

import type { CardRef } from './shareActions';
import type { ShareCard } from './shareCard';
import { canvasSize, paletteFor, safeInsets, type StoryBackground, type StoryFormat } from './storyLayout';

// The wordmark pre-coloured brand green (see PromiseView).
const logo = require('../../../assets/brand/wordmark.png');
const LOGO_ASPECT = 1200 / 496;

export type StoryCardProps = {
  cardRef: CardRef;
  card: ShareCard;
  /** Set when sharing one moment; otherwise the card shows the jar. */
  moment: JarMoment | null;
  /** The moment's own caption (the jar's caption is already in `card`). */
  includeCaption: boolean;
  format: StoryFormat;
  background: StoryBackground;
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
 * The shared image (T-509): one moment whole at 3:4, or the jar's moments in 2 rows of 4, on one of five
 * backgrounds. Moments are drawn with their filter and overlays (MomentCover). Names and captions stay
 * between the safe insets. Sizes are pixels of the exported image times `unit`; text never follows the
 * system text size, because it is part of the picture.
 */
export function StoryCard(props: StoryCardProps) {
  const { cardRef, card, moment, includeCaption, format, background, lidColor, title, date, authorName, tz, unit } =
    props;
  const { t } = useTranslation();
  const px = (n: number) => n * unit;
  const size = canvasSize(format);
  const safe = safeInsets(format);
  const palette = paletteFor(background, lidColor);
  const blurUri = (moment ?? card.moments[0])?.thumbUrl ?? null;
  const font = (family: keyof typeof fontFamilies, n: number, color = palette.text): TextStyle => ({
    fontFamily: fontFamilies[family],
    fontSize: px(n),
    lineHeight: px(n * 1.3),
    color,
  });
  const count = card.moments.length;
  const caption = moment ? (includeCaption ? moment.caption?.trim() || null : null) : card.caption;
  const cardPad = palette.card ? 40 : 0;
  const contentWidth = size.width - 2 * safe.side - 2 * cardPad;
  const gap = 16;
  const tile = (contentWidth - 3 * gap) / 4;

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
      <View
        style={{
          flex: 1,
          paddingTop: px(safe.top),
          paddingBottom: px(safe.bottom),
          paddingHorizontal: px(safe.side),
          justifyContent: 'center',
        }}
      >
        <View
          style={[
            { gap: px(32), flexShrink: 1 },
            moment ? { flex: 1 } : null,
            palette.card ? { backgroundColor: palette.card, borderRadius: px(48), padding: px(cardPad) } : null,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(24) }} testID="share-card-author">
            <View
              style={{
                width: px(88),
                height: px(88),
                borderRadius: px(44),
                backgroundColor: palette.card || background === 'paper' ? colors.brandTint : colors.onDarkControl,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
              <Text
                allowFontScaling={false}
                style={font('bold', 34, palette.card || background === 'paper' ? colors.brandText : palette.text)}
              >
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

          {moment ? (
            <View
              style={{
                flex: 1,
                aspectRatio: photo.aspect,
                alignSelf: 'center',
                borderRadius: px(32),
                overflow: 'hidden',
              }}
              testID={`share-card-${moment.slot}`}
            >
              <MomentCover
                uri={moment.fullUrl ?? moment.thumbUrl}
                edits={parseEdits(moment.edits)}
                stamp={{ capturedAt: new Date(moment.captured_at ?? moment.added_at), tz }}
                accessible={false}
              />
            </View>
          ) : (
            // Rows of 4, not a wrapping row: rounding could push a 4th tile onto the next line.
            <View style={{ gap: px(gap) }}>
              {[card.moments.slice(0, 4), card.moments.slice(4, 8)]
                .filter((row) => row.length > 0)
                .map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: px(gap) }}>
                    {row.map((m) => (
                      <View
                        key={m.id}
                        style={{
                          width: px(tile),
                          height: px(tile / photo.aspect),
                          borderRadius: px(20),
                          overflow: 'hidden',
                          backgroundColor: colors.tileIconWell,
                        }}
                        testID={`share-card-${m.slot}`}
                      >
                        {m.thumbUrl !== null ? (
                          <MomentCover
                            uri={m.thumbUrl}
                            edits={parseEdits(m.edits)}
                            stamp={{ capturedAt: new Date(m.captured_at ?? m.added_at), tz }}
                            accessible={false}
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
            </View>
          )}

          <View style={{ gap: px(16) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: px(24) }}>
              {moment ? (
                <View
                  style={{
                    paddingHorizontal: px(24),
                    paddingVertical: px(8),
                    borderRadius: px(32),
                    backgroundColor: palette.card || background === 'paper' ? colors.brandTint : colors.onDarkControl,
                  }}
                >
                  {/* a11y-fixed-size: drawn into the shared image at the image's scale */}
                  <Text
                    allowFontScaling={false}
                    style={font('bold', 30, palette.card || background === 'paper' ? colors.brandText : palette.text)}
                  >
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
                style={{ width: px(160), height: px(160 / LOGO_ASPECT) }}
                contentFit="contain"
                tintColor={palette.logoTint ?? undefined}
                accessible={false}
              />
            </View>
            {caption ? (
              // a11y-fixed-size: drawn into the shared image at the image's scale
              <Text allowFontScaling={false} numberOfLines={3} style={font('medium', 34)} testID="share-caption">
                {t('share.caption', { caption })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
