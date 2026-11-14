import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import { hitSlopFor } from '@/lib/hitSlop';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { LayoutThumbnail } from './LayoutThumbnail';
import { StoryCard, type StoryCardProps } from './StoryCard';
import {
  canvasSize,
  exportUnit,
  paletteFor,
  storyBackgrounds,
  storyFormats,
  type StoryBackground,
  type StoryFormat,
  type StoryLayout,
  type StoryLayoutId,
} from './storyLayout';
import { photoSource } from '@/lib/image/photoCache';

export type ShareAction = 'save' | 'copy' | 'message';
const ACTIONS: { key: ShareAction | 'shareTo'; icon: IconName }[] = [
  { key: 'save', icon: 'download' },
  { key: 'copy', icon: 'link' },
  { key: 'message', icon: 'comment' },
  { key: 'shareTo', icon: 'share' },
];

export type ShareCardViewProps = {
  insets: EdgeInsets;
  /** Everything the shared image shows; its ref is rendered to the image. */
  story: Omit<StoryCardProps, 'unit'>;
  /** The layouts for the moments on the card, the default first; `story.layout` is the chosen one. */
  layouts: StoryLayout[];
  /** "Share jar" or "Share moment". */
  heading: string;
  includeCaption: boolean;
  /** Short feedback after an action ("Link copied"), or an error. */
  notice: { text: string; error: boolean } | null;
  busy: boolean;
  onLayout: (id: StoryLayoutId) => void;
  onFormat: (format: StoryFormat) => void;
  onBackground: (background: StoryBackground) => void;
  onToggleCaption: (value: boolean) => void;
  onAction: (action: ShareAction) => void;
  /** Share to…: the system share sheet with the image. */
  onShareTo: () => void;
  onBack: () => void;
};

/**
 * Share a jar or a moment (FR-SOC-10, T-509, D-62; design: ShareCard). Picture first: the Story or post
 * image fills the space above a bottom panel of about a third of the screen with the layouts, the
 * backgrounds and the four actions. Format and Include captions sit in the Options sheet. With large text
 * the panel scrolls rather than squeezing the picture (D-37).
 */
export function ShareCardView({
  insets,
  story,
  layouts,
  heading,
  includeCaption,
  notice,
  busy,
  onLayout,
  onFormat,
  onBackground,
  onToggleCaption,
  onAction,
  onShareTo,
  onBack,
}: ShareCardViewProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const screenSize = useWindowDimensions();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const unit = exportUnit(PixelRatio.get());
  const canvas = canvasSize(story.format);
  const full = { width: canvas.width * unit, height: canvas.height * unit };
  const scale = Math.max(0.01, Math.min(stage.width / full.width, stage.height / full.height));
  const swatchUri = (story.moment ?? story.card.moments[0])?.thumbUrl ?? null;
  return (
    <View style={styles.screen} testID="share-screen">
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <RoundIconButton
          icon="back"
          variant="glass"
          accessibilityLabel={t('share.back')}
          onPress={onBack}
          testID="share-back"
        />
        <Text accessibilityRole="header" style={[textStyle('cardTitle'), styles.headerTitle]}>
          {heading}
        </Text>
        <RoundIconButton
          icon="more"
          variant="glass"
          accessibilityLabel={t('share.options.title')}
          onPress={() => setOptionsOpen(true)}
          testID="share-options"
        />
      </View>
      <View
        style={styles.stage}
        onLayout={({ nativeEvent: { layout } }) => setStage({ width: layout.width, height: layout.height })}
      >
        {/* The card is laid out at its export size and only scaled down here, so the saved image is sharp. */}
        <View
          style={{
            width: full.width * scale,
            height: full.height * scale,
            borderRadius: radius.shareCard,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: (full.width * (scale - 1)) / 2,
              top: (full.height * (scale - 1)) / 2,
              transform: [{ scale }],
            }}
          >
            <StoryCard {...story} unit={unit} />
          </View>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            textStyle('bodySmall', '600'),
            styles.notice,
            notice ? styles.noticeShown : null,
            { color: notice?.error ? colors.danger : colors.brandLink },
          ]}
          testID="share-notice"
        >
          {notice?.text ?? ''}
        </Text>
      </View>
      <ScrollView
        style={[styles.sheet, { maxHeight: screenSize.height * sizes.sharePanel }]}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space.lg }]}
        testID="share-panel"
      >
        <View accessibilityRole="radiogroup" accessibilityLabel={t('share.layout.label')} style={styles.layouts}>
          {layouts.map((layout) => (
            <LayoutThumbnail
              key={layout.id}
              layout={layout}
              format={story.format}
              selected={layout.id === story.layout.id}
              accessibilityLabel={t('share.layout.option', { name: t(layout.labelKey) })}
              onPress={() => onLayout(layout.id)}
              testID={`share-layout-${layout.id}`}
            />
          ))}
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('share.background.label')} style={styles.swatches}>
          {storyBackgrounds.map((key) => {
            const palette = paletteFor(key, story.lidColor);
            const selected = key === story.background;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={t(`share.background.${key}`)}
                accessibilityState={{ checked: selected }}
                onPress={() => onBackground(key)}
                hitSlop={hitSlopFor(sizes.shareSwatch, sizes.shareSwatch)}
                style={[styles.swatch, selected && styles.swatchSelected]}
                testID={`share-bg-${key}`}
              >
                <View style={[styles.swatchFill, { backgroundColor: palette.fill }]}>
                  {palette.blurred && swatchUri ? (
                    <Image
                      source={photoSource(swatchUri)}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      blurRadius={6}
                    />
                  ) : null}
                  {palette.card ? <View style={styles.swatchCard} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.actions, large && styles.actionsWrap]}>
          {ACTIONS.map(({ key, icon }) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t(`share.${key}`)}
              onPress={() => (key === 'shareTo' ? onShareTo() : onAction(key))}
              disabled={busy}
              hitSlop={hitSlopFor(sizes.shareAction, sizes.shareAction)}
              style={[styles.action, large && styles.actionLarge]}
              testID={`share-${key}`}
            >
              <View style={[styles.actionWell, key === 'shareTo' && styles.actionWellMain]}>
                <Icon name={icon} color={key === 'shareTo' ? 'surface' : 'ink'} size={22} />
              </View>
              <Text style={[textStyle('bodySmall', '500'), styles.actionLabel]}>{t(`share.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <BottomSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        accessibilityLabel={t('share.options.title')}
        testID="share-options-sheet"
      >
        <View style={styles.options}>
          <Text accessibilityRole="header" style={[textStyle('body', '700'), { color: colors.ink }]}>
            {t('share.options.title')}
          </Text>
          <View style={styles.optionGroup}>
            <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('share.format.label')}</Text>
            <SegmentedControl
              segments={storyFormats.map((key) => ({ key, label: t(`share.format.${key}`) }))}
              selected={story.format}
              onSelect={onFormat}
              accessibilityLabel={t('share.format.label')}
              variant="dark"
              testID="share-format"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('share.includeCaptions')}</Text>
              <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>
                {t(story.moment ? 'share.includeCaptionsBodyMoment' : 'share.includeCaptionsBody')}
              </Text>
            </View>
            <Toggle
              value={includeCaption}
              onValueChange={onToggleCaption}
              accessibilityLabel={t('share.includeCaptions')}
              testID="share-captions"
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xxl, paddingBottom: space.md },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.surface },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: space.md },
  notice: { position: 'absolute', bottom: space.md, alignSelf: 'center', textAlign: 'center' },
  noticeShown: {
    backgroundColor: colors.surface,
    borderRadius: radius.shareAction,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  layouts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatch: {
    width: sizes.shareSwatch,
    height: sizes.shareSwatch,
    borderRadius: sizes.shareSwatch / 2,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.ink },
  swatchFill: {
    flex: 1,
    borderRadius: sizes.shareSwatch / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  swatchCard: { width: '45%', height: '55%', borderRadius: radius.shareTile / 2, backgroundColor: colors.surface },
  sheet: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.noteSheet,
    borderTopRightRadius: radius.noteSheet,
  },
  sheetContent: { paddingHorizontal: space.xxl, paddingTop: space.lg, gap: space.lg },
  options: { gap: space.lg, paddingBottom: space.sm },
  optionGroup: { gap: space.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: space.sm },
  actionLabel: { color: colors.ink, textAlign: 'center' },
  // Large text: two actions a row, so their labels don't run into each other (D-37).
  actionsWrap: { flexWrap: 'wrap', rowGap: space.lg },
  actionLarge: { width: '50%' },
  actionWell: {
    width: sizes.shareAction,
    height: sizes.shareAction,
    borderRadius: radius.shareAction,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Share to… is the main action: brand green with a white icon (rule 12).
  actionWellMain: { backgroundColor: colors.brand },
});
