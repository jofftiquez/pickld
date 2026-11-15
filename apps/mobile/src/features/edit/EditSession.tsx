import { File } from 'expo-file-system';
import { useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { formatShortDate, formatTime } from '@/lib/format';
import { preparePhoto, type PreparedPhoto } from '@/lib/image/pipeline';
import { localDateIn } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { newMomentId } from '@/lib/queue/uploader';
import type { SaveEditsInput } from '@/lib/queue/store';
import type { Visibility } from '@/lib/visibility';
import type { Slot } from '@/theme/tokens';

import { parseEdits } from './edits';
import { EditorView, type EditorStep, type EditorTool } from './EditorView';
import { LeaveDraftDialog } from './LeaveDraftDialog';
import { flipped, isAdjusted, rotatedClockwise, type PhotoAdjust } from './photoAdjust';
import { registerPlaceholderRenderers } from './overlays/PlaceholderOverlay';
import { registerOverlayRenderers } from './overlays/registerRenderers';
import { stickerOverlay } from './stickers/catalog';
import { useEditorImage } from './useEditorImage';
import { useEditorState } from './useEditorState';
import { useCachedPhotoFile } from '@/lib/image/photoCache';

// Stickers, bubbles and text draw with their own renderers (M2-15, M2-16, M2-17), registered first so
// the development placeholders (plain boxes) only fill in for a kind without one.
registerOverlayRenderers();
if (__DEV__) registerPlaceholderRenderers();

export type EditSessionProps = {
  /** The photo being edited (a queued file or an uploaded moment's signed URL). Never changed here; a
   * queued photo's file is swapped once it is prepared (and by Re-crop). */
  photoUri: string;
  /**
   * The quick photo buttons (Rotate, Flip, and Crop with `onCrop`), for a queued photo: on once `ready` (the
   * 3:4 photo is prepared). `onCrop` opens Crop on the photo file as it looks now.
   */
  photoTools?: { ready: boolean; onCrop?: (photoUri: string) => void };
  slot: Slot;
  /** When the photo was taken, shown in its jar's zone. */
  shotAt: Date;
  tz: string;
  /** A queued photo going into a past day's jar (D-156), formatted: the slot tag says "For <day>". */
  forDay?: string | null;
  /** Read once: the saved edits, caption and visibility are the starting point. */
  initial: { caption: string | null; visibility: Visibility; edits: unknown };
  /** "Add to #slot" for a photo just taken, "Done" when editing it again. Already translated. */
  saveLabel: string;
  /** Moment options' Edit caption opens the editor on the details step, the caption focused (M2-23, D-104). */
  focusCaption?: boolean;
  insets: EdgeInsets;
  /** Leaves the editor (back to Today, or wherever it was opened from). */
  onLeave: () => void;
  /** When set, the photo step's Close becomes Back to choose another slot (a shared photo). */
  onBack?: () => void;
  /**
   * Stores what was edited; a rejection keeps the editor open and says the save failed. `photo` is the
   * turned or mirrored photo (full and thumbnail, in the cache) to save in place of `photoUri`, if any.
   */
  onSave: (input: SaveEditsInput, photo: PreparedPhoto | null) => Promise<void>;
  /**
   * For a photo not added yet (just taken, picked or shared, or a draft): leaving any way but Add to #slot
   * (Close, Android back, a dismissed screen) asks Save draft or Discard first. `saveDraft` stores what was
   * edited like `onSave` but keeps the photo on the phone; `discard` deletes it. Neither should throw.
   */
  unfinished?: {
    saveDraft: (input: SaveEditsInput, photo: PreparedPhoto | null) => Promise<void>;
    discard: () => Promise<void>;
  };
};

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file wastes space but loses nothing.
  }
}

const adjustKey = (photoUri: string, adjust: PhotoAdjust) => `${adjust.rotate}${adjust.flip ? 'f' : ''}|${photoUri}`;

/**
 * One editing session on a moment (FR-CAP-04, FR-CAP-05, FR-CAP-08, FR-CAP-09) over the editor's two steps
 * (D-103): the filter and overlays with Undo on the photo step, then the caption and the visibility choice
 * (D-48) on the details step, saved together through `onSave` by Add to #slot / Done. Going between the
 * steps keeps everything; nothing is saved before that. Edits are data; only Rotate and Flip change the
 * photo: each makes the changed 3:4 photo at once (the preparation pipeline, so what shows is what is saved),
 * and Done saves it with the edits.
 */
export function EditSession({
  photoUri,
  photoTools,
  slot,
  shotAt,
  tz,
  forDay,
  initial,
  saveLabel,
  focusCaption = false,
  insets,
  onLeave,
  onBack,
  onSave,
  unfinished,
}: EditSessionProps) {
  const editor = useEditorState(parseEdits(initial.edits));
  // Photos made by Rotate and Flip, by adjust and the photo they were made from, kept so Undo shows them
  // again at once. Each is a cache file, deleted when the editor closes (Done copies the one it saves).
  const [adjusted, setAdjusted] = useState<ReadonlyMap<string, PreparedPhoto>>(() => new Map());
  const made = useRef<string[]>([]);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustFailed, setAdjustFailed] = useState(false);
  const shownPhoto = isAdjusted(editor.adjust) ? (adjusted.get(adjustKey(photoUri, editor.adjust)) ?? null) : null;
  const shownUri = shownPhoto?.full.uri ?? photoUri;
  const image = useEditorImage(useCachedPhotoFile(shownUri));
  // Re-crop replaced the photo, with the adjust shown at the time already in it: the adjust starts over.
  const [base, setBase] = useState(photoUri);
  if (base !== photoUri) {
    setBase(photoUri);
    editor.rebasePhoto();
  }
  const latestBase = useRef(photoUri);
  useEffect(() => {
    latestBase.current = photoUri;
  }, [photoUri]);
  useEffect(() => {
    const files = made.current;
    return () => files.forEach(deleteQuietly);
  }, []);
  const [step, setStep] = useState<EditorStep>(focusCaption ? 'details' : 'photo');
  const [tool, setTool] = useState<EditorTool>('filters');
  const [caption, setCaption] = useState(initial.caption ?? '');
  const [visibility, setVisibility] = useState(initial.visibility);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const adjustTo = async (next: PhotoAdjust) => {
    if (adjusting) return;
    setAdjustFailed(false);
    const from = photoUri;
    if (!isAdjusted(next) || adjusted.has(adjustKey(from, next))) {
      editor.adjustPhoto(next);
      return;
    }
    setAdjusting(true);
    try {
      const out = await preparePhoto(from, next);
      made.current.push(out.full.uri, out.thumb.uri);
      setAdjusted((all) => new Map(all).set(adjustKey(from, next), out));
      // Re-crop may have replaced the photo meanwhile; this one was made from the old photo.
      if (latestBase.current === from) editor.adjustPhoto(next);
    } catch (error) {
      captureError(error, { area: 'edit' });
      setAdjustFailed(true);
    } finally {
      setAdjusting(false);
    }
  };

  const currentInput = (): SaveEditsInput => {
    const trimmed = caption.trim();
    return { caption: trimmed === '' ? null : trimmed, visibility, edits: editor.edits };
  };

  // An unfinished photo never leaves the editor unasked: every removal of this screen (Close, Android back,
  // a parent dismissing it) stops here until Add to #slot, Save draft, Discard or a shared photo's Back has
  // decided. Then the guard comes off and, on the next render, the editor leaves the way it was asked to.
  const navigation = useNavigation();
  type LeaveAction = Parameters<typeof navigation.dispatch>[0];
  const blocked = useRef<LeaveAction | null>(null);
  const [leaving, setLeaving] = useState<{ action: LeaveAction | null; then: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  usePreventRemove(unfinished !== undefined && leaving === null, ({ data }) => {
    blocked.current = data.action;
    setAsking(true);
  });
  const left = useRef(false);
  useEffect(() => {
    if (leaving === null || left.current) return;
    left.current = true;
    if (leaving.action) navigation.dispatch(leaving.action);
    else if (leaving.then) onLeave();
  }, [leaving, navigation, onLeave]);
  /** Decided: the guard comes off; `then` leaves (by the blocked removal, if any, or onLeave). */
  const decide = (then: boolean) => {
    const action = blocked.current;
    blocked.current = null;
    setAsking(false);
    setLeaving({ action: then ? action : null, then });
  };
  const close = () => {
    if (unfinished) setAsking(true);
    else onLeave();
  };
  const keepEditing = () => {
    blocked.current = null;
    setAsking(false);
  };
  const saveDraft = async () => {
    if (!unfinished || savingDraft) return;
    setSavingDraft(true);
    await unfinished.saveDraft(currentInput(), shownPhoto);
    decide(true);
  };
  const discard = async () => {
    if (!unfinished) return;
    await unfinished.discard();
    decide(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(currentInput(), shownPhoto);
    } catch (error) {
      captureError(error, { area: 'edit' });
      setSaving(false);
      setSaveFailed(true);
      return;
    }
    if (unfinished) decide(true);
    else onLeave();
  };

  return (
    <>
      <EditorView
        step={step}
        onChangeStep={setStep}
        image={image}
        photoUri={shownUri}
        slot={slot}
        time={formatTime(shotAt, tz)}
        // A photo from another day says which day, not "Today".
        shotOn={localDateIn(shotAt, tz) === localDateIn(new Date(), tz) ? null : formatShortDate(shotAt, tz)}
        forDay={forDay}
        edits={editor.edits}
        filter={editor.filter}
        tool={tool}
        insets={insets}
        onClose={close}
        onBack={
          onBack &&
          (() => {
            // The guard comes off first; the shared photo's Back leaves on its own once it is discarded.
            decide(false);
            onBack();
          })
        }
        onSelectFilter={editor.selectFilter}
        overlays={editor.edits.overlays}
        selectedOverlayId={editor.selectedId}
        onSelectOverlay={editor.selectOverlay}
        onTransformOverlay={editor.transformOverlay}
        onBringOverlayToFront={editor.bringToFront}
        onDeleteOverlay={editor.deleteOverlay}
        onAddSticker={(sticker) => editor.addOverlay(stickerOverlay(sticker, newMomentId()))}
        onAddOverlay={editor.addOverlay}
        onUpdateOverlay={editor.updateOverlay}
        onSelectTool={setTool}
        caption={caption}
        onChangeCaption={setCaption}
        focusCaption={focusCaption}
        visibility={visibility}
        onChangeVisibility={setVisibility}
        canUndo={editor.canUndo}
        onUndo={editor.undo}
        photoTools={
          photoTools && {
            busy: adjusting,
            disabled: !photoTools.ready,
            onRotate: () => void adjustTo(rotatedClockwise(editor.adjust)),
            onFlip: () => void adjustTo(flipped(editor.adjust)),
            onCrop: photoTools.onCrop && (() => photoTools.onCrop?.(shownUri)),
          }
        }
        adjustFailed={adjustFailed}
        saveLabel={saveLabel}
        saving={saving}
        saveFailed={saveFailed}
        onSave={() => void save()}
      />
      {unfinished ? (
        <LeaveDraftDialog
          visible={asking}
          saving={savingDraft}
          onSaveDraft={() => void saveDraft()}
          onDiscard={() => void discard()}
          onClose={keepEditing}
        />
      ) : null}
    </>
  );
}
