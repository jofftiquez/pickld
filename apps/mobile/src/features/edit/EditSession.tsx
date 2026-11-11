import { useImage } from '@shopify/react-native-skia';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { formatTime } from '@/lib/format';
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { newMomentId } from '@/lib/queue/uploader';
import { releaseEditing, saveEdits, type QueueItem } from '@/lib/queue/store';

import { parseEdits } from './edits';
import { registerBubbleRenderer } from './bubble/BubbleOverlay';
import { EditorView, type EditorTool } from './EditorView';
import { registerPlaceholderRenderers } from './overlays/PlaceholderOverlay';
import { stickerOverlay } from './stickers/catalog';
import { registerStickerRenderer } from './stickers/stickerRenderer';
import { registerTextRenderer } from './text/registerTextRenderer';
import { useEditorState } from './useEditorState';

// Until the sticker, bubble and text tools register their renderers (M2-15, M2-16, M2-17), development
// builds draw overlays as plain boxes so the transform engine can be tried. Release builds draw nothing.
registerStickerRenderer();
// Bubbles draw with their own renderer (M2-16), registered first so the placeholder leaves them alone.
registerBubbleRenderer();
registerTextRenderer();
if (__DEV__) registerPlaceholderRenderers();

export const queueItemQueryKey = (id: number) => ['queueItem', id] as const;

export type EditSessionProps = {
  /** The queued moment, read once: its saved edits, caption and privacy are the starting point. */
  item: QueueItem;
  insets: EdgeInsets;
  /** Leaves the editor (back to Today, or wherever it was opened from). */
  onLeave: () => void;
};

/**
 * One editing session on a queued moment (FR-CAP-05, FR-CAP-08, FR-CAP-09): the filter and overlays with Undo, the caption and
 * the privacy switch, saved into the queue item by Add to #slot / Done. However the editor is left, the
 * item's editing hold ends and the upload worker is woken, so the photo is never stuck in the queue.
 */
export function EditSession({ item, insets, onLeave }: EditSessionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const image = useImage(item.photoUri);
  const editor = useEditorState(parseEdits(item.edits));
  const [tool, setTool] = useState<EditorTool>('filters');
  const [caption, setCaption] = useState(item.caption ?? '');
  const [isPrivate, setIsPrivate] = useState(item.isPrivate);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // A photo just taken is held for the editor; one that is already waiting is being edited again.
  const [isNew] = useState(item.editingSince !== null);

  // Closing without saving (Close, back gesture) keeps the photo queued as it is, and lets it upload.
  useEffect(() => {
    const id = item.id;
    return () => {
      void releaseEditing(id)
        .catch((error: unknown) => captureError(error, { area: 'edit' }))
        .finally(() => void requestUploads());
    };
  }, [item.id]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const trimmed = caption.trim();
      const saved = await saveEdits(item.id, {
        caption: trimmed === '' ? null : trimmed,
        isPrivate,
        edits: editor.edits,
      });
      // Reopening the editor starts from what was saved, not a cached copy from before.
      queryClient.setQueryData(queueItemQueryKey(item.id), saved);
    } catch (error) {
      captureError(error, { area: 'edit' });
      setSaving(false);
      setSaveFailed(true);
      return;
    }
    void requestUploads();
    onLeave();
  };

  const shotAt = item.capturedAt === null ? new Date(item.createdAt) : new Date(item.capturedAt);
  return (
    <EditorView
      image={image}
      slot={item.slot}
      time={formatTime(shotAt, item.tz)}
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
      isPrivate={isPrivate}
      onChangePrivate={setIsPrivate}
      canUndo={editor.canUndo}
      onUndo={editor.undo}
      saveLabel={isNew ? t('edit.addToSlot', { slot: t(`slots.${item.slot}`) }) : t('edit.done')}
      saving={saving}
      saveFailed={saveFailed}
      onSave={() => void save()}
    />
  );
}
