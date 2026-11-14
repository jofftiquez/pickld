import { useImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { formatShortDate, formatTime } from '@/lib/format';
import { localDateIn } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { newMomentId } from '@/lib/queue/uploader';
import type { SaveEditsInput } from '@/lib/queue/store';
import type { Visibility } from '@/lib/visibility';
import type { Slot } from '@/theme/tokens';

import { parseEdits } from './edits';
import { EditorView, type EditorStep, type EditorTool } from './EditorView';
import { registerPlaceholderRenderers } from './overlays/PlaceholderOverlay';
import { registerOverlayRenderers } from './overlays/registerRenderers';
import { stickerOverlay } from './stickers/catalog';
import { useEditorState } from './useEditorState';
import { useCachedPhotoFile } from '@/lib/image/photoCache';

// Stickers, bubbles and text draw with their own renderers (M2-15, M2-16, M2-17), registered first so
// the development placeholders (plain boxes) only fill in for a kind without one.
registerOverlayRenderers();
if (__DEV__) registerPlaceholderRenderers();

export type EditSessionProps = {
  /** The photo being edited (a queued file or an uploaded moment's signed URL). Never changed here. */
  photoUri: string;
  slot: Slot;
  /** When the photo was taken, shown in its jar's zone. */
  shotAt: Date;
  tz: string;
  /** Read once: the saved edits, caption and visibility are the starting point. */
  initial: { caption: string | null; visibility: Visibility; edits: unknown };
  /** "Add to #slot" for a photo just taken, "Done" when editing it again. Already translated. */
  saveLabel: string;
  /** Moment options' Edit caption opens the editor on the details step, the caption focused (M2-23, D-104). */
  focusCaption?: boolean;
  insets: EdgeInsets;
  /** Leaves the editor (back to Today, or wherever it was opened from). */
  onLeave: () => void;
  /** Stores what was edited; a rejection keeps the editor open and says the save failed. */
  onSave: (input: SaveEditsInput) => Promise<void>;
};

/**
 * One editing session on a moment (FR-CAP-04, FR-CAP-05, FR-CAP-08, FR-CAP-09) over the editor's two steps
 * (D-103): the filter and overlays with Undo on the photo step, then the caption and the visibility choice
 * (D-48) on the details step, saved together through `onSave` by Add to #slot / Done. Going between the
 * steps keeps everything; nothing is saved before that. Edits are data; the photo is never changed.
 */
export function EditSession({
  photoUri,
  slot,
  shotAt,
  tz,
  initial,
  saveLabel,
  focusCaption = false,
  insets,
  onLeave,
  onSave,
}: EditSessionProps) {
  const image = useImage(useCachedPhotoFile(photoUri) ?? undefined);
  const editor = useEditorState(parseEdits(initial.edits));
  const [step, setStep] = useState<EditorStep>(focusCaption ? 'details' : 'photo');
  const [tool, setTool] = useState<EditorTool>('filters');
  const [caption, setCaption] = useState(initial.caption ?? '');
  const [visibility, setVisibility] = useState(initial.visibility);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const trimmed = caption.trim();
      await onSave({ caption: trimmed === '' ? null : trimmed, visibility, edits: editor.edits });
    } catch (error) {
      captureError(error, { area: 'edit' });
      setSaving(false);
      setSaveFailed(true);
      return;
    }
    onLeave();
  };

  return (
    <EditorView
      step={step}
      onChangeStep={setStep}
      image={image}
      photoUri={photoUri}
      slot={slot}
      time={formatTime(shotAt, tz)}
      // A photo from another day says which day, not "Today".
      shotOn={localDateIn(shotAt, tz) === localDateIn(new Date(), tz) ? null : formatShortDate(shotAt, tz)}
      edits={editor.edits}
      filter={editor.filter}
      tool={tool}
      insets={insets}
      onClose={onLeave}
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
      saveLabel={saveLabel}
      saving={saving}
      saveFailed={saveFailed}
      onSave={() => void save()}
    />
  );
}
