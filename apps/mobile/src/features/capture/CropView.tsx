import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { TextSizeSlider } from '@/features/edit/text/TextSizeSlider';
import type { Size } from '@/lib/image/crop';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, crop, radius, sizes, space } from '@/theme/tokens';

import { CropHeaderAction } from './CropHeaderAction';
import { CropPhoto } from './CropPhoto';
import { CropToolButton } from './CropToolButton';
import { cropFrame, MAX_ZOOM, MIN_ZOOM, type CropState } from './cropMath';

export type CropViewProps = {
  uri: string;
  image: Size;
  /** Already translated, e.g. "#afternoon". */
  slotLabel: string;
  state: CropState;
  busy: boolean;
  /** Queueing the photo failed: say so above the tools. */
  failed: boolean;
  /** `recrop`: Moment options' Re-crop on a saved moment (M2-23); the copy says Save instead of Next: edit. */
  mode?: 'gallery' | 'recrop';
  insets: EdgeInsets;
  onChange: (state: CropState) => void;
  onZoom: (zoom: number) => void;
  onRotate: () => void;
  onFlip: () => void;
  onFit: () => void;
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
};

/** The zoom slider works in percent (100–300), as the design's range input does. */
const PERCENT = 100;

/**
 * Crop (FR-CAP-03; design: Crop): a header with Cancel, the title and the main button (Next: edit, or Save
 * crop for Re-crop) as a green pill like the editor's Save (D-59, D-65); the photo under the fixed 3:4
 * frame; a white sheet with the zoom slider and Rotate, Flip, Fit and Reset. The frame is sized so the
 * sheet fits without scrolling; it scrolls only when large text makes it taller (D-37). From 1.5× text the
 * title moves to its own row under the buttons, as in the editor's toolbar.
 */
export function CropView(props: CropViewProps) {
  const { uri, image, slotLabel, state, busy, failed, insets, onChange, onZoom, mode = 'gallery' } = props;
  const { t } = useTranslation();
  const copy = mode === 'recrop' ? 'crop.recrop' : 'crop';
  const window = useWindowDimensions();
  const largeText = useLargeText();
  const frame = cropFrame(window, insets);
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
      <Text style={[textStyle('label', '500'), styles.subtitle]}>{t(`${copy}.subtitle`, { slot: slotLabel })}</Text>
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
      <CropPhoto uri={uri} image={image} frame={frame} areaWidth={window.width} state={state} onChange={onChange} />
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space.xxl }]}
        bounces={false}
      >
        {failed ? (
          <Text accessibilityLiveRegion="polite" style={[textStyle('bodySmall'), styles.error]} testID="crop-error">
            {t(`${copy}.saveFailed`)}
          </Text>
        ) : null}
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
        <View style={styles.tools} testID="crop-tools">
          <CropToolButton
            icon="rotate"
            label={t('crop.rotate')}
            accessibilityLabel={t('crop.rotateLabel')}
            onPress={props.onRotate}
            testID="crop-rotate"
          />
          <CropToolButton
            icon="mirror"
            label={t('crop.flip')}
            accessibilityHint={t('crop.flipHint')}
            onPress={props.onFlip}
            testID="crop-flip"
          />
          <CropToolButton
            icon="fit"
            label={t('crop.fit')}
            accessibilityHint={t('crop.fitHint')}
            onPress={props.onFit}
            testID="crop-fit"
          />
          {/* A tool like the others: it only undoes the crop changes; the header's button saves. */}
          <CropToolButton
            icon="reset"
            label={t('crop.reset')}
            accessibilityHint={t('crop.resetHint')}
            onPress={props.onReset}
            testID="crop-reset"
          />
        </View>
        <Text style={[textStyle('label', '400'), styles.note]}>{t('crop.note')}</Text>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit one line at large text instead of pushing the header's buttons off screen (D-37).
  headerTitle: { flexShrink: 1 },
  root: { flex: 1, backgroundColor: colors.editor },
  // The heights here are the ones cropFrame counts (CROP_HEADER_HEIGHT, CROP_SHEET_HEIGHT).
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
  note: { color: colors.muted, textAlign: 'center', minHeight: crop.noteHeight },
  error: { color: colors.danger, textAlign: 'center' },
});
