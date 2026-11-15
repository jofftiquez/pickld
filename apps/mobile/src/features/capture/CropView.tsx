import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextSizeSlider } from '@/features/edit/text/TextSizeSlider';
import { fitFrames, type FitFrame, type Size } from '@/lib/image/crop';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, crop, fitFrameColors, radius, sizes, space } from '@/theme/tokens';

import { CropHeaderAction } from './CropHeaderAction';
import { CropPhoto } from './CropPhoto';
import { CropToolButton } from './CropToolButton';
import { CROP_RATIO, cropFrame, MAX_ZOOM, MIN_ZOOM, MOMENT_CROP_SHEET_HEIGHT, type CropState } from './cropMath';

/** Fill crops the photo to the frame (today's crop); Fit places it whole inside the frame (D-152). */
export type CropLayout = 'fill' | 'fit';

export type CropViewProps = {
  uri: string;
  image: Size;
  /** Already translated, e.g. "#afternoon". Not shown for `avatar` and `cover`. */
  slotLabel: string;
  /** A gallery photo going into a past day's jar (D-156), formatted: the subtitle names that day. */
  forDay?: string | null;
  state: CropState;
  busy: boolean;
  /** Queueing the photo failed: say so above the tools. */
  failed: boolean;
  /**
   * `recrop`: Moment options' Re-crop on a saved moment (M2-23); the copy says Save instead of Next: edit.
   * `avatar` and `cover`: Edit profile's photos (D-79): a square frame under a circle guide, or the cover's
   * 5:2 band; pan and zoom only, so Fill / Fit, Rotate and Flip are hidden (Reset stays).
   */
  mode?: 'gallery' | 'recrop' | 'avatar' | 'cover';
  /** Moments only (D-152): Fill or Fit, and the frame style Fit draws around the photo. */
  layout?: CropLayout;
  frame?: FitFrame;
  onLayout?: (layout: CropLayout) => void;
  onFrame?: (frame: FitFrame) => void;
  insets: EdgeInsets;
  onChange: (state: CropState) => void;
  onZoom: (zoom: number) => void;
  /** Moments only. */
  onRotate?: () => void;
  onFlip?: () => void;
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
};

/** Each mode's copy under `crop` in en.json. */
const COPY = { gallery: 'crop', recrop: 'crop.recrop', avatar: 'crop.avatar', cover: 'crop.cover' } as const;

/** The zoom slider works in percent (100–300), as the design's range input does. */
const PERCENT = 100;

/**
 * Crop (FR-CAP-03; design: Crop): a header with Cancel, the title and the main button (Next: edit, or Save
 * crop for Re-crop) as a green pill like the editor's Save (D-59, D-65); the photo under the fixed 3:4
 * frame (square or 5:2 for Edit profile's photos, D-79); a white sheet with Fill / Fit (D-152), the zoom
 * slider (Fit's frame styles in its place when Fit is on) and Rotate, Flip and Reset (only the zoom slider
 * and Reset for profile photos). The frame is sized so the
 * sheet fits without scrolling; it scrolls only when large text makes it taller (D-37). From 1.5× text the
 * title moves to its own row under the buttons, as in the editor's toolbar.
 */
export function CropView(props: CropViewProps) {
  const { uri, image, slotLabel, state, busy, failed, insets, onChange, onZoom, mode = 'gallery' } = props;
  const { layout = 'fill', frame: fitFrame = 'white', forDay = null } = props;
  const { t } = useTranslation();
  const profile = mode === 'avatar' || mode === 'cover';
  const copy = COPY[mode];
  // The frame's shape (lock chip, note): the moment copy unless it's a profile photo.
  const shape = profile ? COPY[mode] : 'crop';
  const window = useWindowDimensions();
  const largeText = useLargeText();
  const frame = profile
    ? cropFrame(window, insets, CROP_RATIO[mode])
    : cropFrame(window, insets, CROP_RATIO.moment, MOMENT_CROP_SHEET_HEIGHT);
  const fit = !profile && layout === 'fit' ? fitFrame : null;
  const title = (
    <View style={styles.title}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityRole="header"
        style={[textStyle('cropTitle'), styles.headerTitle, styles.titleText]}
      >
        {t('crop.title')}
      </Text>
      <Text style={[textStyle('label', '500'), styles.subtitle]}>
        {mode === 'gallery' && forDay
          ? t('crop.subtitleFor', { slot: slotLabel, date: forDay })
          : t(`${copy}.subtitle`, { slot: slotLabel })}
      </Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]} testID="crop-screen">
      <View style={styles.header} testID="crop-header">
        <View style={styles.headerRow}>
          <CropHeaderAction
            label={t('crop.cancel')}
            hint={t(`${copy}.cancelHint`)}
            onPress={props.onCancel}
            testID="crop-cancel"
          />
          {largeText ? <View style={styles.middle} /> : title}
          <View style={styles.action}>
            <PillButton
              label={t(`${copy}.done`)}
              accessibilityHint={t(`${copy}.doneHint`, { slot: slotLabel })}
              onPress={props.onDone}
              disabled={busy}
              testID="crop-done"
            />
          </View>
        </View>
        {largeText ? title : null}
      </View>
      <CropPhoto
        uri={uri}
        image={image}
        frame={frame}
        areaWidth={window.width}
        state={state}
        onChange={onChange}
        aspect={t(`${shape}.aspect`)}
        aspectLabel={t(`${shape}.aspectLabel`)}
        circle={mode === 'avatar'}
        fit={fit}
      />
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space.xxl }]}
        bounces={false}
      >
        {failed && !profile ? (
          <Text accessibilityLiveRegion="polite" style={[textStyle('bodySmall'), styles.error]} testID="crop-error">
            {t(mode === 'recrop' ? 'crop.recrop.saveFailed' : 'crop.saveFailed')}
          </Text>
        ) : null}
        {profile ? null : (
          <SegmentedControl
            segments={[
              { key: 'fill', label: t('crop.layout.fill') },
              { key: 'fit', label: t('crop.layout.fit') },
            ]}
            selected={layout}
            onSelect={(next: CropLayout) => props.onLayout?.(next)}
            accessibilityLabel={t('crop.layout.label')}
            variant="dark"
            testID="crop-layout"
          />
        )}
        {fit ? (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('crop.frame.label')}
            style={styles.swatches}
            testID="crop-frames"
          >
            {fitFrames.map((key) => {
              const selected = key === fit;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={t('crop.frame.option', { name: t(`crop.frame.${key}`) })}
                  accessibilityState={{ checked: selected }}
                  onPress={() => props.onFrame?.(key)}
                  style={[styles.swatch, selected && styles.swatchSelected]}
                  testID={`crop-frame-${key}`}
                >
                  <View style={[styles.swatchFill, key === 'blur' ? null : { backgroundColor: fitFrameColors[key] }]}>
                    {key === 'blur' ? (
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={6} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.zoomRow}>
            <Icon name="zoomOut" color="muted" size={crop.zoomIcon} strokeWidth={2} />
            <TextSizeSlider
              value={Math.round(state.zoom * PERCENT)}
              min={MIN_ZOOM * PERCENT}
              max={MAX_ZOOM * PERCENT}
              step={10}
              onChange={(value) => onZoom(value / PERCENT)}
              onCommit={(value) => onZoom(value / PERCENT)}
              accessibilityLabel={t('crop.zoom')}
              testID="crop-zoom"
            />
            <Icon name="zoomIn" color="muted" size={crop.zoomIcon} strokeWidth={2} />
          </View>
        )}
        <View style={styles.tools} testID="crop-tools">
          {profile ? null : (
            <>
              <CropToolButton
                icon="rotate"
                label={t('crop.rotate')}
                accessibilityLabel={t('crop.rotateLabel')}
                onPress={() => props.onRotate?.()}
                testID="crop-rotate"
              />
              <CropToolButton
                icon="mirror"
                label={t('crop.flip')}
                accessibilityHint={t('crop.flipHint')}
                onPress={() => props.onFlip?.()}
                testID="crop-flip"
              />
            </>
          )}
          {/* A tool like the others: it only undoes the crop changes; the header's button saves. */}
          <CropToolButton
            icon="reset"
            label={t('crop.reset')}
            accessibilityHint={t('crop.resetHint')}
            onPress={props.onReset}
            testID="crop-reset"
          />
        </View>
        <Text style={[textStyle('label', '400'), styles.note]}>{t(`${shape}.note`)}</Text>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit one line at large text instead of pushing the header's buttons off screen (D-37).
  headerTitle: { flexShrink: 1 },
  root: { flex: 1, backgroundColor: colors.editor },
  // The heights here are the ones cropFrame counts (CROP_HEADER_HEIGHT, CROP_SHEET_HEIGHT, and for moments
  // MOMENT_CROP_SHEET_HEIGHT with the Fill / Fit row).
  header: {
    paddingTop: crop.headerPaddingTop,
    paddingBottom: space.sm,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
    gap: space.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: sizes.minTap },
  // The pill keeps its full label; the title takes the space between, as in the editor's toolbar.
  action: { flexShrink: 0 },
  middle: { flex: 1 },
  title: { flex: 1, alignItems: 'center', gap: crop.titleGap },
  titleText: { color: colors.surface, textAlign: 'center' },
  subtitle: { color: colors.cropSubtitle, textAlign: 'center' },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheetContent: { flexGrow: 1, gap: space.lg, paddingTop: crop.sheetPaddingTop, paddingHorizontal: space.xl },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tools: { flexDirection: 'row', gap: space.sm },
  // As tall as the zoom row it replaces, so switching to Fit doesn't move the tools.
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: sizes.minTap,
  },
  swatch: {
    width: crop.frameSwatch,
    height: crop.frameSwatch,
    borderRadius: crop.frameSwatch / 2,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.ink },
  swatchFill: {
    flex: 1,
    borderRadius: crop.frameSwatch / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  note: { color: colors.muted, textAlign: 'center', minHeight: crop.noteHeight },
  error: { color: colors.danger, textAlign: 'center' },
});
