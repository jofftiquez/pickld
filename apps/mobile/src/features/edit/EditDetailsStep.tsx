import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { MomentView } from '@/features/moment/MomentView';
import { VISIBILITIES, VISIBILITY_KEY, type Visibility } from '@/lib/visibility';
import { textStyle } from '@/theme/text';
import { colors, radius, space, type Slot } from '@/theme/tokens';

import type { Edits } from './edits';
import { useStampMoment } from './stickers/stamps';

export type EditDetailsStepProps = {
  /** The photo being edited; drawn small with the edits made on the photo step. */
  photoUri: string;
  edits: Edits;
  slot: Slot;
  /** The fixed toolbar's measured height: the content starts below it. */
  toolbarHeight: number;
  bottomInset: number;
  caption: string;
  onChangeCaption: (caption: string) => void;
  /** Opened from Moment options' Edit caption (M2-23, D-104): the caption field starts focused. */
  focusCaption: boolean;
  /** Who can see the moment (D-48): Readers, Everyone or Only me, starting at the owner's default. */
  visibility: Visibility;
  onChangeVisibility: (visibility: Visibility) => void;
  saveFailed: boolean;
};

export const CAPTION_MAX = 150;

// The preview is a small 3:4 copy of the edited photo, as on Instagram's details step: under half the
// screen's width, and never wider than this.
const PREVIEW_SHARE = 0.44;
const PREVIEW_MAX = 200;

/**
 * The editor's second step (D-103; design: EditDetails): the edited photo small (drawn by MomentView,
 * so it looks as it will in the jar), the caption, the slot's hashtag (fixed by the slot, read-only) and
 * who can see the moment. Save is in the toolbar.
 */
export function EditDetailsStep({
  photoUri,
  edits,
  slot,
  toolbarHeight,
  bottomInset,
  caption,
  onChangeCaption,
  focusCaption,
  visibility,
  onChangeVisibility,
  saveFailed,
}: EditDetailsStepProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const stamp = useStampMoment();
  const previewWidth = Math.round(Math.min(window.width * PREVIEW_SHARE, PREVIEW_MAX));
  const hashtag = t(`slots.${slot}`);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: toolbarHeight + space.lg }]}
      scrollIndicatorInsets={{ top: toolbarHeight }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      testID="editor-details"
    >
      <View style={styles.preview}>
        <MomentView uri={photoUri} edits={edits} width={previewWidth} stamp={stamp} testID="editor-preview" />
      </View>
      <View style={[styles.sheet, { paddingBottom: bottomInset + space.xxl }]}>
        <TextField
          label={t('edit.caption')}
          value={caption}
          onChangeText={onChangeCaption}
          maxLength={CAPTION_MAX}
          // Several lines, so a long caption can be read back whole; Return closes the keyboard.
          multiline
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          placeholder={t('edit.captionPlaceholder')}
          autoFocus={focusCaption}
          testID="editor-caption"
        />
        <View
          style={styles.row}
          accessible
          accessibilityLabel={t('edit.hashtagLabel', { slot: hashtag })}
          testID="editor-hashtag"
        >
          <Text style={[textStyle('bodyMedium', '600'), styles.label]}>{t('edit.hashtag')}</Text>
          <View style={styles.hashtag}>
            <Text style={[textStyle('bodySmall', '700'), styles.hashtagText]}>{hashtag}</Text>
          </View>
        </View>
        <View style={styles.visibility}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text style={[textStyle('bodyMedium', '600'), styles.label]}>{t('edit.visibility')}</Text>
            <Text style={[textStyle('label', '500'), styles.hint]}>
              {t(`visibility.${VISIBILITY_KEY[visibility]}Body`)}
            </Text>
          </View>
          <SegmentedControl
            variant="dark"
            segments={VISIBILITIES.map((key) => ({ key, label: t(`visibility.${VISIBILITY_KEY[key]}`) }))}
            selected={visibility}
            onSelect={onChangeVisibility}
            accessibilityLabel={t('edit.visibility')}
            testID="editor-visibility"
          />
        </View>
        {saveFailed ? (
          <Text
            style={[textStyle('bodySmall'), styles.error]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {t('edit.saveFailed')}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.editor },
  content: { flexGrow: 1 },
  preview: {
    alignSelf: 'center',
    marginBottom: space.xxl,
    overflow: 'hidden',
    borderRadius: radius.tile,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  // Wraps at large text, so the hashtag drops under its label instead of squeezing it.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  label: { color: colors.ink },
  hint: { color: colors.muted },
  hashtag: {
    backgroundColor: colors.subtle,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  hashtagText: { color: colors.brandText },
  visibility: { gap: space.sm },
  error: { color: colors.danger },
});
