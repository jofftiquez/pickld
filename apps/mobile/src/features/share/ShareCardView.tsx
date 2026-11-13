import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import { hitSlopFor } from '@/lib/hitSlop';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { StoryCard, type StoryCardProps } from './StoryCard';
import {
  canvasSize,
  exportUnit,
  paletteFor,
  storyBackgrounds,
  storyFormats,
  type StoryBackground,
  type StoryFormat,
} from './storyLayout';

export type ShareAction = 'save' | 'copy' | 'message' | 'more';
const ACTIONS: { key: ShareAction; icon: IconName; label: 'save' | 'copy' | 'message' | 'more' }[] = [
  { key: 'save', icon: 'download', label: 'save' },
  { key: 'copy', icon: 'link', label: 'copy' },
  { key: 'message', icon: 'comment', label: 'message' },
  { key: 'more', icon: 'more', label: 'more' },
];

export type ShareCardViewProps = {
  insets: EdgeInsets;
  /** Everything the shared image shows; its ref is rendered to the image. */
  story: Omit<StoryCardProps, 'unit'>;
  /** "Share jar" or "Share moment". */
  heading: string;
  includeCaption: boolean;
  /** Short feedback after an action ("Link copied"), or an error. */
  notice: { text: string; error: boolean } | null;
  busy: boolean;
  onFormat: (format: StoryFormat) => void;
  onBackground: (background: StoryBackground) => void;
  onToggleCaption: (value: boolean) => void;
  onAction: (action: ShareAction) => void;
  onShareTo: () => void;
  onBack: () => void;
};

/**
 * Share a jar or a moment (FR-SOC-10, T-509; design: ShareCard): the Story or post image, its format and
 * background, Include captions, and the share actions.
 */
export function ShareCardView({
  insets,
  story,
  heading,
  includeCaption,
  notice,
  busy,
  onFormat,
  onBackground,
  onToggleCaption,
  onAction,
  onShareTo,
  onBack,
}: ShareCardViewProps) {
  const { t } = useTranslation();
  const large = useLargeText();
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
        <View style={styles.headerSpace} />
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
      </View>
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space.lg }]}
      >
        <SegmentedControl
          segments={storyFormats.map((key) => ({ key, label: t(`share.format.${key}`) }))}
          selected={story.format}
          onSelect={onFormat}
          accessibilityLabel={t('share.format.label')}
          variant="dark"
          testID="share-format"
        />
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
                      source={{ uri: swatchUri }}
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
        <View style={[styles.actions, large && styles.actionsWrap]}>
          {ACTIONS.map(({ key, icon, label }) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t(`share.${label}`)}
              onPress={() => onAction(key)}
              disabled={busy}
              hitSlop={hitSlopFor(sizes.shareAction, sizes.shareAction)}
              style={[styles.action, large && styles.actionLarge]}
              testID={`share-${key}`}
            >
              <View style={styles.actionWell}>
                <Icon name={icon} color="ink" size={22} />
              </View>
              <Text style={[textStyle('bodySmall', '500'), styles.actionLabel]}>{t(`share.${label}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            textStyle('bodySmall', '600'),
            styles.notice,
            { color: notice?.error ? colors.danger : colors.brandLink },
          ]}
          testID="share-notice"
        >
          {notice?.text ?? ' '}
        </Text>
        <PrimaryButton icon="share" label={t('share.shareTo')} onPress={onShareTo} disabled={busy} testID="share-to" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xxl, paddingBottom: space.md },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.surface },
  headerSpace: { width: sizes.roundButton },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: space.md },
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
  sheetContent: { padding: space.xxl, gap: space.lg },
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
  notice: { textAlign: 'center' },
});
