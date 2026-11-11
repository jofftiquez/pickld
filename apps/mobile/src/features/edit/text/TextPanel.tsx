import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { textFontStyle } from './textFonts';
import {
  DEFAULT_TEXT_STYLE,
  newOverlayId,
  newTextOverlay,
  TEXT_MAX,
  TEXT_SIZE,
  textAlignSchema,
  textColorSchema,
  textColorValues,
  textFontSchema,
  type TextOverlay,
  type TextPatch,
  type TextStyle,
} from './textOverlay';
import { TextSizeSlider } from './TextSizeSlider';

export type TextPanelProps = {
  /** The selected text overlay, which the panel edits; null to write a new one. */
  selected: TextOverlay | null;
  onAdd: (overlay: TextOverlay) => void;
  /** One Undo step: a style tap, a slider drag, or the text when typing ends. */
  onChange: (id: string, patch: TextPatch) => void;
};

/** One slider step for screen readers, in points. */
const SIZE_STEP = 2;

/**
 * The Text tool's panel (FR-CAP-07, design: Text): the text (up to 80 characters), Clean, Bold, Type
 * and Serif, six colors, a size slider and left or center alignment. With a text overlay selected every
 * control edits it; otherwise they set up the next text, added with Add text. Render it with a `key`
 * that changes with the selected overlay's id and text, so the field starts from them.
 */
export function TextPanel({ selected, onAdd, onChange }: TextPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(selected?.text ?? '');
  const [nextStyle, setNextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const style: TextStyle = selected
    ? { font: selected.font, color: selected.color, size: selected.size, align: selected.align }
    : nextStyle;
  const trimmed = draft.trim();

  const changeStyle = (patch: Partial<TextStyle>) => {
    if (selected) onChange(selected.id, patch);
    else setNextStyle((s) => ({ ...s, ...patch }));
  };

  const commitText = () => {
    if (!selected) return;
    // Text can't be emptied here: delete the overlay instead. The field goes back to what is saved.
    if (trimmed === '') setDraft(selected.text);
    else if (trimmed !== selected.text) onChange(selected.id, { text: trimmed });
  };

  const add = () => {
    if (trimmed === '') return;
    onAdd(newTextOverlay(newOverlayId(), trimmed.slice(0, TEXT_MAX), style));
  };

  return (
    <View style={styles.root} testID="editor-panel-text">
      <TextField
        label={t('editText.field')}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={commitText}
        maxLength={TEXT_MAX}
        placeholder={t('editText.placeholder')}
        accessibilityHint={selected ? t('editText.fieldHintSelected') : undefined}
        testID="editor-text-field"
      />
      {selected ? null : (
        <PillButton
          label={t('editText.add')}
          onPress={add}
          disabled={trimmed === ''}
          icon="plus"
          testID="editor-text-add"
        />
      )}

      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('editText.fonts')}>
        {textFontSchema.options.map((font) => {
          const on = font === style.font;
          return (
            <Pressable
              key={font}
              accessibilityRole="radio"
              accessibilityLabel={t('editText.fontLabel', { font: t(`editText.font.${font}`) })}
              accessibilityState={{ checked: on }}
              onPress={() => changeStyle({ font })}
              style={[styles.font, on ? styles.on : styles.off]}
              testID={`editor-text-font-${font}`}
            >
              <Text style={[textFontStyle(font, 14), { color: on ? colors.surface : colors.ink }]} numberOfLines={1}>
                {t(`editText.font.${font}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('editText.colors')}>
        <Text style={[textStyle('label'), styles.rowLabel]} importantForAccessibility="no" accessibilityElementsHidden>
          {t('editText.color')}
        </Text>
        {textColorSchema.options.map((color) => {
          const on = color === style.color;
          return (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={t(`editText.colorName.${color}`)}
              accessibilityState={{ checked: on }}
              onPress={() => changeStyle({ color })}
              hitSlop={hitSlopFor(SWATCH_OUTER, SWATCH_OUTER)}
              style={[styles.swatchRing, on ? styles.swatchRingOn : null]}
              testID={`editor-text-color-${color}`}
            >
              <View style={[styles.swatch, { backgroundColor: textColorValues[color] }]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <Text style={[textStyle('label'), styles.rowLabel]} importantForAccessibility="no" accessibilityElementsHidden>
          {t('editText.size')}
        </Text>
        <TextSizeSlider
          value={style.size}
          min={TEXT_SIZE.min}
          max={TEXT_SIZE.max}
          step={SIZE_STEP}
          onCommit={(size) => changeStyle({ size })}
          accessibilityLabel={t('editText.sizeLabel')}
          testID="editor-text-size"
        />
        {textAlignSchema.options.map((align) => {
          const on = align === style.align;
          return (
            <Pressable
              key={align}
              accessibilityRole="radio"
              accessibilityLabel={t(`editText.align.${align}`)}
              accessibilityState={{ checked: on }}
              onPress={() => changeStyle({ align })}
              style={[styles.align, on ? styles.alignOn : styles.off]}
              testID={`editor-text-align-${align}`}
            >
              <Icon name={align === 'left' ? 'alignLeft' : 'alignCenter'} size={18} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The swatch, its white gap and its ring; the ring's room is kept when unselected so nothing shifts.
const SWATCH_OUTER = sizes.textSwatch + 4 * sizes.textSwatchRing;

const styles = StyleSheet.create({
  root: { gap: space.md + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  font: {
    flex: 1,
    minWidth: sizes.minTap,
    minHeight: sizes.minTap,
    borderRadius: radius.thumbLg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  on: { backgroundColor: colors.ink },
  off: { backgroundColor: colors.subtle },
  // A minimum, not a fixed width, so the label grows with large text.
  rowLabel: { minWidth: sizes.textRowLabel, color: colors.muted },
  swatchRing: {
    width: SWATCH_OUTER,
    height: SWATCH_OUTER,
    borderRadius: SWATCH_OUTER / 2,
    borderWidth: sizes.textSwatchRing,
    borderColor: colors.surface, // invisible on the white panel
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingOn: { borderColor: colors.ink },
  swatch: {
    width: sizes.textSwatch,
    height: sizes.textSwatch,
    borderRadius: sizes.textSwatch / 2,
    borderWidth: 1,
    borderColor: colors.toggleOff,
  },
  align: {
    width: sizes.minTap,
    height: sizes.minTap,
    borderRadius: radius.thumbLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignOn: { backgroundColor: colors.brandTint },
});
