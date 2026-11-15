import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { textStyle } from '@/theme/text';
import { bubble, colors, space } from '@/theme/tokens';

import {
  BUBBLE_TEXT_MAX,
  bubbleColorSchema,
  bubbleShapeSchema,
  type Bubble,
  type BubbleColor,
  type BubbleShape,
  type BubbleTail,
  type Overlay,
} from '../edits';
import { bubbleTailSide, clampBubbleText } from './bubbleLayout';
import { BubbleStyleTile } from './BubbleStyleTile';
import { BubbleSwatch } from './BubbleSwatch';
import { BubbleTailButton } from './BubbleTailButton';

export type BubblePanelProps = {
  overlays: readonly Overlay[];
  selectedId: string | null;
  /** Adds the overlay on top and selects it; `group` lets the typing that follows join its Undo step. */
  onAdd: (overlay: Overlay, group?: string) => void;
  /** Changes an overlay's content; changes in the same `group` back to back are one Undo step. */
  onUpdate: (id: string, update: (overlay: Overlay) => Overlay, group?: string) => void;
  /** New bubble ids (tests pass a fixed one). */
  newId?: () => string;
};

/** Where a new bubble lands: upper middle of the photo, 60 % of its width, upright. */
const NEW_BUBBLE = { x: 0.5, y: 0.3, scale: 0.6, rotation: 0 } as const;

const randomId = () => `bubble-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Typing into one bubble is one Undo step until something else happens.
const textGroup = (id: string) => `bubble-text:${id}`;

/**
 * The Bubble tool (FR-CAP-06, design: Bubble): the text first (up to 60 characters), then Speech, Thought
 * (a cloud), Shout and Whisper, the tail flipped left or right, and six colors. With a bubble selected on the photo, the
 * panel edits it; otherwise a style tap, or typing, adds a new bubble with the chosen style, color and
 * tail side (the left until flipped).
 */
export function BubblePanel({ overlays, selectedId, onAdd, onUpdate, newId = randomId }: BubblePanelProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const wide = fontScale >= 1.5;
  const selected = overlays.find((o): o is Bubble => o.type === 'bubble' && o.id === selectedId) ?? null;
  const [nextShape, setNextShape] = useState<BubbleShape>('speech');
  const [nextColor, setNextColor] = useState<BubbleColor>('white');
  const [nextTail, setNextTail] = useState<BubbleTail>('left');
  const shape = selected?.shape ?? nextShape;
  const color = selected?.color ?? nextColor;
  const tail = selected ? bubbleTailSide(selected) : nextTail;

  type Content = Pick<Bubble, 'shape' | 'color' | 'text' | 'tail' | 'cloud'>;
  // New thoughts are clouds; older thoughts stay pills until their style is picked again.
  const cloudFor = (s: BubbleShape) => (s === 'thought' ? { cloud: true } : null);
  const add = (content: Required<Omit<Content, 'cloud'>>, group?: (id: string) => string) => {
    const id = newId();
    onAdd({ id, type: 'bubble', ...NEW_BUBBLE, ...content, ...cloudFor(content.shape) }, group?.(id));
  };
  const update = (id: string, patch: Partial<Content>, group?: string) =>
    onUpdate(id, (o) => (o.type === 'bubble' ? { ...o, ...patch } : o), group);

  const chooseShape = (next: BubbleShape) => {
    setNextShape(next);
    if (selected) update(selected.id, { shape: next, ...cloudFor(next) });
    else add({ shape: next, color, text: '', tail });
  };
  const chooseColor = (next: BubbleColor) => {
    setNextColor(next);
    if (selected) update(selected.id, { color: next });
  };
  const flipTail = () => {
    const next: BubbleTail = tail === 'left' ? 'right' : 'left';
    setNextTail(next);
    if (selected) update(selected.id, { tail: next });
  };
  const changeText = (raw: string) => {
    const text = clampBubbleText(raw, BUBBLE_TEXT_MAX);
    if (selected) update(selected.id, { text }, textGroup(selected.id));
    else if (text.trim() !== '') add({ shape, color, text, tail }, textGroup);
  };

  return (
    <View style={styles.root} testID="editor-panel-bubble">
      <TextField
        label={t('editBubble.text')}
        value={selected?.text ?? ''}
        onChangeText={changeText}
        maxLength={BUBBLE_TEXT_MAX}
        accessibilityHint={t('editBubble.textHint')}
        autoCapitalize="sentences"
        testID="bubble-text"
      />
      <View style={styles.styles} accessibilityLabel={t('editBubble.styles')} testID="bubble-styles">
        {bubbleShapeSchema.options.map((s) => (
          <BubbleStyleTile
            key={s}
            shape={s}
            label={t(`editBubble.shape.${s}`)}
            selected={s === shape}
            accessibilityHint={t('editBubble.styleHint')}
            onPress={() => chooseShape(s)}
            wide={wide}
            testID={`bubble-style-${s}`}
          />
        ))}
      </View>
      <View style={styles.tailRow}>
        <Text
          style={[textStyle('label'), styles.colorLabel]}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {t('editBubble.tail')}
        </Text>
        <BubbleTailButton
          tail={tail}
          label={t('editBubble.flip')}
          accessibilityLabel={t(`editBubble.flipLabel.${tail}`)}
          accessibilityHint={t('editBubble.flipHint')}
          onPress={flipTail}
          testID="bubble-tail"
        />
      </View>
      <View style={styles.colorRow} accessibilityLabel={t('editBubble.colors')} testID="bubble-colors">
        <Text
          style={[textStyle('label'), styles.colorLabel]}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {t('editBubble.color')}
        </Text>
        {bubbleColorSchema.options.map((c) => (
          <BubbleSwatch
            key={c}
            color={c}
            label={t(`editBubble.colorName.${c}`)}
            selected={c === color}
            onPress={() => chooseColor(c)}
            testID={`bubble-color-${c}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md + 2 },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // 10 px between the label and the circles, as designed: each circle reserves 4 px on each side for its ring.
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 - 4 * bubble.swatchRing },
  colorLabel: { minWidth: bubble.colorLabelWidth, color: colors.muted },
  tailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 },
});
