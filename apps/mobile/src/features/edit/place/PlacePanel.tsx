import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PillButton } from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { textStyle } from '@/theme/text';
import { bubble, colors, space } from '@/theme/tokens';

import { BubbleSwatch } from '../bubble/BubbleSwatch';
import { bubbleColorSchema, PLACE_TEXT_MAX, type BubbleColor, type Overlay, type Place } from '../edits';
import { newOverlayId } from '../text/textOverlay';
import { lookUpCurrentPlace, lookUpPhotoPlace, type PlaceLookup } from './currentPlace';
import { usePhotoPlace, type Coords } from './photoPlace';
import { newPlaceScale, rescalePlace } from './placeLayout';

export type PlacePanelProps = {
  selected: Place | null;
  /** Adds the overlay on top and selects it; `group` lets the typing that follows join its Undo step. */
  onAdd: (overlay: Overlay, group?: string) => void;
  /** Changes an overlay's content; changes in the same `group` back to back are one Undo step. */
  onUpdate: (id: string, update: (overlay: Overlay) => Overlay, group?: string) => void;
  /** The town the phone is in, asked only on "Use where I am" (tests pass a stand-in). */
  lookUp?: () => Promise<PlaceLookup>;
  /** The town at the photo's own coordinates, asked only on "Use the photo's location" (tests pass a stand-in). */
  lookUpPhoto?: (coords: Coords) => Promise<PlaceLookup>;
};

// Typing into one place is one Undo step until something else happens.
const typingGroup = (id: string) => `place-text:${id}`;

/** Where a new place lands: low on the photo, centred, upright. */
const NEW_PLACE = { x: 0.5, y: 0.82, rotation: 0 } as const;

/**
 * The Place tool: a sticker that says where the photo was taken, only when the user adds one. They type
 * the place, tap "Use where I am" to fill in the town the phone is in (asked then, never before), or, for a
 * picked or shared photo that carries coordinates, "Use the photo's location" (photoPlace.ts); they can
 * change the words either way. Only the words on the sticker are saved, never the location.
 * With a place selected on the photo, the panel edits it; otherwise typing adds one.
 */
export function PlacePanel({
  selected,
  onAdd,
  onUpdate,
  lookUp = lookUpCurrentPlace,
  lookUpPhoto = lookUpPhotoPlace,
}: PlacePanelProps) {
  const { t } = useTranslation();
  const photoCoords = usePhotoPlace();
  const [nextColor, setNextColor] = useState<BubbleColor>('white');
  const color = selected?.color ?? nextColor;
  const [looking, setLooking] = useState<'photo' | 'current' | null>(null);
  const [problem, setProblem] = useState<'denied' | 'failed' | 'photoFailed' | null>(null);
  // The place the first keystroke added, until it comes back selected (fast typing, as in TextPanel).
  const justAdded = useRef<string | null>(null);
  useEffect(() => {
    justAdded.current = null;
  }, [selected?.id]);
  // What the field shows: the selected place, or blank typing that can't be saved yet.
  const [draft, setDraft] = useState(selected?.text ?? '');
  const [shown, setShown] = useState({ id: selected?.id, text: selected?.text });
  if (shown.id !== selected?.id || shown.text !== selected?.text) {
    setShown({ id: selected?.id, text: selected?.text });
    setDraft(selected?.text ?? '');
  }

  const setText = (id: string, text: string, group?: string) =>
    onUpdate(id, (o) => (o.type === 'place' ? { ...o, text, scale: rescalePlace(o, text) } : o), group);
  const add = (text: string, group?: (id: string) => string) => {
    const id = newOverlayId();
    justAdded.current = id;
    onAdd({ id, type: 'place', ...NEW_PLACE, scale: newPlaceScale(text), text, color }, group?.(id));
  };

  const changeText = (raw: string) => {
    const text = Array.from(raw).slice(0, PLACE_TEXT_MAX).join('');
    setDraft(text);
    setProblem(null);
    if (text.trim() === '') return; // a place can't be blank; the saved one stays until editing ends
    const target = selected?.id ?? justAdded.current;
    if (target) setText(target, text, typingGroup(target));
    else add(text, typingGroup);
  };
  const endEditing = () => {
    if (!selected) return;
    const trimmed = draft.trim();
    if (trimmed === '') setDraft(selected.text);
    else if (trimmed !== selected.text) setText(selected.id, trimmed, typingGroup(selected.id));
  };
  const fillFrom = async (source: 'photo' | 'current') => {
    setProblem(null);
    setLooking(source);
    const result = source === 'photo' && photoCoords ? await lookUpPhoto(photoCoords) : await lookUp();
    setLooking(null);
    if (result.kind !== 'found') {
      setProblem(result.kind === 'failed' && source === 'photo' ? 'photoFailed' : result.kind);
      return;
    }
    if (selected) setText(selected.id, result.text);
    else add(result.text);
  };
  const chooseColor = (next: BubbleColor) => {
    setNextColor(next);
    if (selected) onUpdate(selected.id, (o) => (o.type === 'place' ? { ...o, color: next } : o));
  };

  return (
    <View style={styles.root} testID="editor-panel-place">
      <TextField
        label={t('editPlace.field')}
        value={draft}
        onChangeText={changeText}
        onEndEditing={endEditing}
        maxLength={PLACE_TEXT_MAX}
        placeholder={t('editPlace.placeholder')}
        accessibilityHint={selected ? t('editPlace.fieldHintSelected') : t('editPlace.fieldHint')}
        autoCapitalize="words"
        returnKeyType="done"
        testID="place-text"
      />
      <View style={styles.row}>
        {photoCoords ? (
          <PillButton
            label={looking === 'photo' ? t('editPlace.looking') : t('editPlace.usePhoto')}
            accessibilityHint={t('editPlace.usePhotoHint')}
            onPress={() => void fillFrom('photo')}
            disabled={looking !== null}
            icon="photo"
            variant="subtle"
            testID="place-use-photo"
          />
        ) : null}
        <PillButton
          label={looking === 'current' ? t('editPlace.looking') : t('editPlace.useCurrent')}
          accessibilityHint={t('editPlace.useCurrentHint')}
          onPress={() => void fillFrom('current')}
          disabled={looking !== null}
          icon="pin"
          variant="subtle"
          testID="place-use-current"
        />
      </View>
      {problem ? (
        <Text
          style={[textStyle('bodySmall'), styles.problem]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          testID={`place-${problem}`}
        >
          {t(`editPlace.${problem}`)}
        </Text>
      ) : null}
      <View style={styles.colorRow} accessibilityLabel={t('editPlace.colors')} testID="place-colors">
        <Text style={[textStyle('label'), styles.label]} importantForAccessibility="no" accessibilityElementsHidden>
          {t('editBubble.color')}
        </Text>
        {bubbleColorSchema.options.map((c) => (
          <BubbleSwatch
            key={c}
            color={c}
            label={t(`editBubble.colorName.${c}`)}
            selected={c === color}
            onPress={() => chooseColor(c)}
            testID={`place-color-${c}`}
          />
        ))}
      </View>
      <Text style={[textStyle('bodySmall'), styles.note]} testID="place-privacy">
        {t('editPlace.privacy')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md + 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // 10 px between the label and the circles, as in the Bubble panel.
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 - 4 * bubble.swatchRing },
  label: { minWidth: bubble.colorLabelWidth, color: colors.muted },
  problem: { color: colors.danger },
  note: { color: colors.muted },
});
