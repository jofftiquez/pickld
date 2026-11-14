import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/GlassSurface';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SlotTag } from '@/features/capture/SlotTag';
import { useLargeText } from '@/lib/useLargeText';
import { colors, space } from '@/theme/tokens';

export type EditorToolbarProps = {
  /** The safe area above the toolbar (status bar, Dynamic Island). */
  topInset: number;
  /** The slot's name, already translated ("#afternoon"). */
  slot: string;
  /** Capture time, formatted for the slot tag. */
  time: string;
  /** Close leaves the editor; Back returns from the details step to the photo step (D-103). */
  leading: 'close' | 'back';
  onLeading: () => void;
  /** "Next" on the photo step; "Add to #slot" or "Done" on the details step. Already translated. */
  actionLabel: string;
  actionHint?: string;
  actionTestID: 'editor-next' | 'editor-save';
  actionDisabled: boolean;
  onAction: () => void;
  /** The toolbar's full height (safe area included), so the content starts below it. */
  onHeight: (height: number) => void;
};

/**
 * The editor's fixed top bar (D-59, D-103): Close or Back, the slot tag, and Next (photo step) or Save
 * (details step). The content scrolls under its dark surface: Liquid Glass on iOS 26, a frosted blur below
 * that or with Reduce Transparency on (D-57, D-80). From 1.5× text the slot tag moves to its own row under
 * the buttons (D-37).
 */
export function EditorToolbar({
  topInset,
  slot,
  time,
  leading,
  onLeading,
  actionLabel,
  actionHint,
  actionTestID,
  actionDisabled,
  onAction,
  onHeight,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const largeText = useLargeText();
  const tag = <SlotTag slot={slot} time={time} />;
  return (
    <View
      accessibilityRole="toolbar"
      style={[styles.bar, { paddingTop: topInset + space.sm }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      testID="editor-toolbar"
    >
      <GlassSurface
        tone="dark"
        tint={colors.liquidDarkTint}
        fallbackColor={colors.glass}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        testID="editor-toolbar-surface"
      />
      <View style={styles.row}>
        {leading === 'close' ? (
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('common.close')}
            onPress={onLeading}
            testID="editor-close"
          />
        ) : (
          <RoundIconButton
            icon="back"
            variant="glass"
            accessibilityLabel={t('edit.back')}
            accessibilityHint={t('edit.backHint')}
            onPress={onLeading}
            testID="editor-back"
          />
        )}
        <View style={styles.middle}>{largeText ? null : tag}</View>
        <View style={styles.actions}>
          <PillButton
            label={actionLabel}
            accessibilityHint={actionHint}
            onPress={onAction}
            disabled={actionDisabled}
            testID={actionTestID}
          />
        </View>
      </View>
      {largeText ? <View style={styles.tagRow}>{tag}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  middle: { flex: 1, alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  tagRow: { alignItems: 'center' },
});
