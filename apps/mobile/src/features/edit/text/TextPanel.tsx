import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { textFontStyle } from './textFonts';
import {
  contrastColor,
  DEFAULT_TEXT_STYLE,
  newOverlayId,
  newTextOverlay,
  TEXT_MAX,
  TEXT_PALETTE,
  textAlignSchema,
  textBackgroundSchema,
  textColorValues,
  textFontSchema,
  textStyleOf,
  type TextBackground,
  type TextColor,
  type TextOverlay,
  type TextPatch,
  type TextStyle,
} from './textOverlay';

export type TextPanelProps = {
  /** The selected text overlay, which the panel edits; null to write a new one. */
  selected: TextOverlay | null;
  /** How many texts are on the photo, so a new one is placed below the last. */
  textCount: number;
  /** Adds a text and selects it; `group` joins the typing that follows into its Undo step. */
  onAdd: (overlay: TextOverlay, group: string) => void;
  /** A style tap is one Undo step; typing passes a `group`, so a run of it is one. */
  onChange: (id: string, patch: TextPatch, group?: string) => void;
  /** Lets go of the selected text, to write a new one. */
  onDeselect: () => void;
};

const typingGroup = (id: string) => `text-typing:${id}`;

/**
 * The Text tool's panel (FR-CAP-07, design: Text, after Instagram's stories): the text first, as many
 * lines as wanted (up to 80 characters), showing on the photo from the first letter; New text to start
 * another; then the fonts, colors, a background (none, solid or soft), an outline in its own color, and
 * left or center alignment. With a text selected every control edits it; otherwise they set up the next
 * one. There is no size control: a text is sized on the photo with a pinch, like a sticker.
 */
export function TextPanel({ selected, textCount, onAdd, onChange, onDeselect }: TextPanelProps) {
  const { t } = useTranslation();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [nextStyle, setNextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [typing, setTyping] = useState(false);
  // The text the first keystroke added, until it comes back selected. Fast typing can send the next
  // keystroke first, and that one must edit it rather than add a second text.
  const justAdded = useRef<string | null>(null);
  useEffect(() => {
    justAdded.current = null;
  }, [selected?.id]);
  const style = selected ? textStyleOf(selected) : { ...nextStyle, background: nextStyle.background ?? 'none' };
  // What the field shows: the selected text as saved, or what is being typed while it can't be saved
  // (blank). When the selected text changes (typing, Undo, another selection) the field follows it.
  const [draft, setDraft] = useState(selected?.text ?? '');
  const [shown, setShown] = useState({ id: selected?.id, text: selected?.text });
  if (shown.id !== selected?.id || shown.text !== selected?.text) {
    setShown({ id: selected?.id, text: selected?.text });
    setDraft(selected?.text ?? '');
  }

  const changeStyle = (patch: TextPatch) => {
    if (selected) onChange(selected.id, patch);
    else setNextStyle((s) => ({ ...s, ...patch }));
  };

  const changeText = (raw: string) => {
    const text = raw.slice(0, TEXT_MAX);
    setDraft(text);
    if (text.trim() === '') return; // a text can't be blank; the saved one stays until editing ends
    const target = selected?.id ?? justAdded.current;
    if (target) {
      onChange(target, { text }, typingGroup(target));
    } else {
      const id = newOverlayId();
      justAdded.current = id;
      onAdd(newTextOverlay(id, text, style, textCount), typingGroup(id));
    }
  };

  const endEditing = () => {
    setTyping(false);
    if (!selected) return;
    const trimmed = draft.trim();
    if (trimmed === '') setDraft(selected.text);
    else if (trimmed !== selected.text) onChange(selected.id, { text: trimmed }, typingGroup(selected.id));
  };

  const newText = () => {
    justAdded.current = null;
    onDeselect();
    input.current?.focus();
  };

  const backgrounds = textBackgroundSchema.options;
  const nextBackground: TextBackground =
    backgrounds[(backgrounds.indexOf(style.background) + 1) % backgrounds.length] ?? 'none';

  return (
    <View style={styles.root} testID="editor-panel-text">
      <TextField
        inputRef={input}
        label={t('editText.field')}
        value={draft}
        onChangeText={changeText}
        onEndEditing={endEditing}
        onFocus={() => setTyping(true)}
        maxLength={TEXT_MAX}
        multiline
        placeholder={t('editText.placeholder')}
        accessibilityHint={selected ? t('editText.fieldHintSelected') : t('editText.fieldHint')}
        autoCapitalize="sentences"
        testID="editor-text-field"
      />
      {selected || typing ? (
        <View style={styles.actions}>
          {selected ? (
            <PillButton
              label={t('editText.newText')}
              accessibilityHint={t('editText.newTextHint')}
              onPress={newText}
              icon="plus"
              testID="editor-text-new"
            />
          ) : null}
          <View style={styles.spacer} />
          {typing ? (
            // Return starts a new line, so the keyboard is closed here.
            <PillButton
              label={t('editText.done')}
              accessibilityHint={t('editText.doneHint')}
              onPress={() => Keyboard.dismiss()}
              variant="dark"
              testID="editor-text-done"
            />
          ) : null}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('editText.fonts')}
        contentContainerStyle={styles.fonts}
        testID="editor-text-fonts"
      >
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
              {/* a11y-fixed-size: a sample of the face in a fixed chip; the radio's label names it */}
              <Text
                allowFontScaling={false}
                style={[textFontStyle(font, 16), { color: on ? colors.surface : colors.ink }]}
                numberOfLines={1}
              >
                {t(`editText.font.${font}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Swatches
        label={t('editText.colors')}
        selected={style.color}
        onSelect={(color) => changeStyle({ color })}
        testID="editor-text-color"
      />

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`editText.background.${style.background}`)}
          accessibilityHint={t('editText.backgroundHint', { next: t(`editText.background.${nextBackground}`) })}
          onPress={() => changeStyle({ background: nextBackground })}
          style={[styles.toggle, style.background === 'none' ? styles.off : styles.toggleOn]}
          testID="editor-text-background"
        >
          <View
            style={[
              styles.glyphBox,
              style.background === 'solid'
                ? { backgroundColor: textColorValues[style.color] }
                : style.background === 'soft'
                  ? styles.glyphSoft
                  : null,
            ]}
          >
            {/* a11y-fixed-size: a glyph drawn in a fixed square, like an icon */}
            <Text
              allowFontScaling={false}
              style={[
                textFontStyle('bold', 16),
                {
                  color:
                    style.background === 'solid'
                      ? textColorValues[contrastColor(style.color)]
                      : style.background === 'soft'
                        ? colors.surface
                        : colors.ink,
                },
              ]}
            >
              {t('editText.backgroundGlyph')}
            </Text>
          </View>
          <Text style={[textStyle('label'), styles.toggleText]}>{t('editText.backgroundShort')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('editText.outline')}
          accessibilityState={{ checked: style.outline !== undefined }}
          onPress={() => changeStyle({ outline: style.outline ? undefined : contrastColor(style.color) })}
          style={[styles.toggle, style.outline ? styles.toggleOn : styles.off]}
          testID="editor-text-outline"
        >
          <Icon name="edit" size={18} strokeWidth={2} />
          <Text style={[textStyle('label'), styles.toggleText]}>{t('editText.outline')}</Text>
        </Pressable>
        <View style={styles.spacer} />
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

      {style.outline ? (
        <Swatches
          label={t('editText.outlineColors')}
          heading={t('editText.outlineColors')}
          selected={style.outline}
          onSelect={(outline) => changeStyle({ outline })}
          testID="editor-text-outline-color"
        />
      ) : null}
    </View>
  );
}

function Swatches({
  label,
  heading,
  selected,
  onSelect,
  testID,
}: {
  label: string;
  heading?: string;
  selected: TextColor;
  onSelect: (color: TextColor) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.swatchGroup}>
      {heading ? (
        <Text style={[textStyle('label'), styles.heading]} importantForAccessibility="no" accessibilityElementsHidden>
          {heading}
        </Text>
      ) : null}
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label} testID={`${testID}s`}>
        {TEXT_PALETTE.map((color) => {
          const on = color === selected;
          return (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={t(`editText.colorName.${color}`)}
              accessibilityState={{ checked: on }}
              onPress={() => onSelect(color)}
              hitSlop={hitSlopFor(SWATCH_OUTER, SWATCH_OUTER)}
              style={[styles.swatchRing, on ? styles.swatchRingOn : null]}
              testID={`${testID}-${color}`}
            >
              <View style={[styles.swatch, { backgroundColor: textColorValues[color] }]} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fonts: { gap: space.sm, paddingRight: space.sm },
  font: {
    minWidth: sizes.minTap,
    minHeight: sizes.minTap,
    borderRadius: radius.thumbLg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  on: { backgroundColor: colors.ink },
  off: { backgroundColor: colors.subtle },
  swatchGroup: { gap: space.xs },
  heading: { color: colors.muted },
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
  toggle: {
    minHeight: sizes.minTap,
    borderRadius: radius.thumbLg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
  },
  toggleOn: { backgroundColor: colors.brandTint },
  toggleText: { color: colors.ink },
  glyphBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  glyphSoft: { backgroundColor: colors.textOverlayShadow },
  spacer: { flex: 1 },
  align: {
    width: sizes.minTap,
    height: sizes.minTap,
    borderRadius: radius.thumbLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignOn: { backgroundColor: colors.brandTint },
});
