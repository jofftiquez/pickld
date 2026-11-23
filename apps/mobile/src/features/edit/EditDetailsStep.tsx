import { useTranslation } from 'react-i18next';
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { completeMention, typingMention } from '@/features/moment/momentTags';
import { MomentView } from '@/features/moment/MomentView';
import { VISIBILITIES, VISIBILITY_KEY, type Visibility } from '@/lib/visibility';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space, type Slot } from '@/theme/tokens';

import { PHOTO_DESCRIPTION_MAX, type Edits } from './edits';
import { editorPhotoStyles, useEditorPhotoFrame } from './editorPhotoFrame';
import { useTaggablePeople } from './mention/useTaggablePeople';
import { useStampMoment } from './stickers/stamps';

export type EditDetailsStepProps = {
  /** The photo being edited, drawn with the edits made on the photo step. */
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
  /** The photo description screen readers read to everyone who can see the moment (0174). */
  description: string;
  onChangeDescription: (description: string) => void;
  /** Who can see the moment (D-48): Readers, Everyone or Only me, starting at the owner's default. */
  visibility: Visibility;
  onChangeVisibility: (visibility: Visibility) => void;
  /** A first-time guide tip (FR-ONB-10), under Who can see this moment. */
  guideTip?: ReactNode;
  saveFailed: boolean;
  /** Goes back to the photo step, as the toolbar's Back does. */
  onEditPhoto: () => void;
};

export const CAPTION_MAX = 150;

/**
 * The editor's second step (D-103; design: EditDetails): the edited photo at the size and place it has on
 * the photo step, with the same parallax under the sheet (drawn by MomentView, so it looks as it will in the jar), the caption, the photo description for screen readers, the slot's hashtag (fixed by the slot, read-only) and
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
  description,
  onChangeDescription,
  visibility,
  onChangeVisibility,
  saveFailed,
  onEditPhoto,
  guideTip,
}: EditDetailsStepProps) {
  const { t } = useTranslation();
  const stamp = useStampMoment();
  const { width, height, panelMinHeight, panelTop, onScroll, photoMotion, reduceMotion } =
    useEditorPhotoFrame(toolbarHeight);
  // Writing the caption slides the sheet up over the photo, as far as the photo step's panel goes, so the
  // field sits above the keyboard with the photo's top still in view.
  const scroller = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const raiseSheet = () => scroller.current?.scrollTo({ y: panelTop, animated: !reduceMotion });
  // A first-time guide tip sits under Who can see this moment, below the fold: bring it into view once.
  const hasTip = guideTip != null;
  useEffect(() => {
    if (hasTip) scroller.current?.scrollToEnd({ animated: !reduceMotion });
  }, [hasTip, reduceMotion]);
  const hashtag = t(`slots.${slot}`);
  // Typing @ at the end of the caption suggests people it can tag: mutual readers only (0172).
  const typing = typingMention(caption);
  const suggestions = useTaggablePeople(typing ?? '', { enabled: typing !== null, limit: 5 });
  const people = typing !== null ? (suggestions.data ?? []) : [];

  return (
    <Animated.ScrollView
      ref={scroller}
      style={editorPhotoStyles.root}
      contentContainerStyle={[editorPhotoStyles.content, { paddingTop: toolbarHeight }]}
      scrollIndicatorInsets={{ top: toolbarHeight }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      onScroll={onScroll}
      scrollEventThrottle={16}
      testID="editor-details"
    >
      {/* As on Instagram, tapping the photo goes back to editing it. */}
      <Animated.View style={[editorPhotoStyles.photo, { width, height }, photoMotion]} testID="editor-preview-frame">
        <Pressable
          onPress={onEditPhoto}
          accessibilityRole="button"
          accessibilityLabel={t('edit.editPhoto')}
          accessibilityHint={t('edit.editPhotoHint')}
          testID="editor-preview-edit"
        >
          <MomentView uri={photoUri} edits={edits} width={width} stamp={stamp} testID="editor-preview" />
        </Pressable>
      </Animated.View>
      <View
        style={[
          editorPhotoStyles.panel,
          styles.sheet,
          { minHeight: panelMinHeight, paddingBottom: bottomInset + space.xxl },
        ]}
      >
        <TextField
          label={t('edit.caption')}
          value={caption}
          onChangeText={onChangeCaption}
          maxLength={CAPTION_MAX}
          // Several lines, so a long caption can be read back whole; Return closes the keyboard.
          multiline
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          // The slot's own question, so there is something to answer.
          placeholder={t(`edit.captionPrompt.${slot}`)}
          autoFocus={focusCaption}
          onFocus={raiseSheet}
          testID="editor-caption"
        />
        {people.length > 0 ? (
          <View
            style={styles.suggestions}
            accessibilityLabel={t('edit.mentionSuggestions')}
            testID="editor-caption-mentions"
          >
            {people.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => onChangeCaption(completeMention(caption, person.username).slice(0, CAPTION_MAX))}
                accessibilityRole="button"
                accessibilityLabel={t('edit.mentionSuggestion', {
                  name: person.displayName,
                  username: person.username,
                })}
                hitSlop={space.xs}
                style={styles.suggestion}
                testID={`editor-caption-mention-${person.username}`}
              >
                <Text style={[textStyle('bodySmall', '700'), styles.suggestionText]} numberOfLines={1}>
                  @{person.username}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.description}>
          <TextField
            label={t('edit.description')}
            value={description}
            onChangeText={onChangeDescription}
            maxLength={PHOTO_DESCRIPTION_MAX}
            multiline
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            placeholder={t('edit.descriptionPlaceholder')}
            accessibilityHint={t('edit.descriptionHint')}
            onFocus={raiseSheet}
            testID="editor-description"
          />
          <Text
            style={[textStyle('label', '500'), styles.hint]}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {t('edit.descriptionHint')}
          </Text>
        </View>
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
        {guideTip}
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
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: space.xl, gap: space.lg },
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
  description: { gap: space.xs },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm },
  suggestion: {
    backgroundColor: colors.subtle,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: sizes.minTap - 2 * space.xs,
    justifyContent: 'center',
  },
  suggestionText: { color: colors.brandLink },
  error: { color: colors.danger },
});
