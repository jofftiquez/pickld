import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePendingCrop } from '@/features/capture/pendingCrop';
import { todayQueryKeys, type Me } from '@/features/jar/useToday';
import type { GridTile } from '@/features/jar/todayGrid';
import { formatShortDate, formatTime } from '@/lib/format';
import { captureError } from '@/lib/monitoring';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import type { Visibility } from '@/lib/visibility';
import type { Slot } from '@/theme/tokens';

import {
  deleteMoment,
  MomentOptionError,
  moveMoment,
  setMomentVisibility,
  type MomentTarget,
  type OptionError,
} from './momentActions';
import { MomentOptionsSheet, type MomentOptionsMode } from './MomentOptionsSheet';
import { openRecrop } from './recrop';
import { useSetJarCover } from './useSetJarCover';

export type MomentOptionsSelection = {
  tile: GridTile;
  target: MomentTarget;
  /** Offer Set as cover (D-56): an uploaded live moment that isn't already the owner's pick. */
  canSetCover?: boolean;
};

export type MomentOptionsProps = {
  visible: boolean;
  /** Which options the sheet shows (MomentOptionsSheet); the moment preview opens `more` and `visibility`. */
  mode?: MomentOptionsMode;
  /** The tile the sheet is about; kept after closing so the sheet can animate out. */
  selection: MomentOptionsSelection;
  userId: string;
  /** Empty slots in the same jar (D-3). */
  freeSlots: readonly Slot[];
  /** The jar's IANA zone, for the time in the header. */
  tz: string;
  onClose: () => void;
};

/** The edit route for a moment: its queue row id until it is uploaded, then its moment id. */
function editHref(target: MomentTarget, focusCaption: boolean): string {
  const id = target.kind === 'queued' ? String(target.queueId) : target.momentId;
  return focusCaption ? `/edit/${id}?focus=caption` : `/edit/${id}`;
}

/**
 * Moment options (M2-23, FR-CAP-10), opened from the moment preview (QA item 3). Visibility, Move, Set as
 * cover (D-56) and Delete apply here and Today refreshes
 * underneath; Edit caption and Edit stickers and filters open the editor, Re-crop the Crop screen. See
 * momentActions.ts for what each does to a queued or an uploaded moment.
 */
export function MomentOptions({ visible, mode, selection, userId, freeSlots, tz, onClose }: MomentOptionsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const setCover = useSetJarCover(userId);
  const { tile, target } = selection;
  // A queued photo left at the owner's default shows that default; Readers until the profile has loaded.
  const [visibility, setVisibility] = useState<Visibility>(
    () => tile.visibility ?? queryClient.getQueryData<Me>(todayQueryKeys.me(userId))?.defaultVisibility ?? 'readers',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OptionError | null>(null);

  const refreshToday = () => {
    void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
    // The day page and its preview (D-55) read a past day through ['day', userId, date].
    void queryClient.invalidateQueries({ queryKey: ['day', userId] });
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
  };

  /** Runs one option; on failure the sheet stays open and says why. */
  const run = async (option: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await option();
    } catch (cause) {
      captureError(cause, { area: 'moment-options' });
      setError(cause instanceof MomentOptionError ? cause.reason : 'failed');
      setBusy(false);
      return false;
    }
    setBusy(false);
    return true;
  };

  const openEditor = (focusCaption: boolean) => {
    onClose();
    router.push(editHref(target, focusCaption));
  };

  const time = tile.time === null ? null : new Date(tile.time);
  return (
    <MomentOptionsSheet
      visible={visible}
      mode={mode}
      slot={tile.slot}
      when={
        time === null ? '' : t('momentOptions.when', { time: formatTime(time, tz), date: formatShortDate(time, tz) })
      }
      thumbUri={tile.uri}
      edits={tile.edits}
      visibility={visibility}
      freeSlots={freeSlots}
      busy={busy}
      error={error}
      onEditCaption={() => openEditor(true)}
      onEditMoment={() => openEditor(false)}
      onRecrop={() => {
        void run(async () => {
          setPendingCrop(await openRecrop({ target, slot: tile.slot, userId }));
        }).then((ok) => {
          if (!ok) return;
          onClose();
          router.push('/crop');
        });
      }}
      onChangeVisibility={(next) => {
        void run(() => setMomentVisibility(getSupabase(), target, next)).then((ok) => {
          if (!ok) return;
          setVisibility(next);
          refreshToday();
        });
      }}
      onMove={(slot) => {
        void run(() => moveMoment(getSupabase(), target, slot)).then((ok) => {
          if (!ok) return;
          refreshToday();
          onClose();
          showToast('momentMoved', { slot: t(`slots.${slot}`) });
        });
      }}
      onSetCover={
        selection.canSetCover && target.kind === 'server'
          ? () => {
              void run(() => setCover(target.jarId, target.momentId)).then((ok) => {
                if (ok) onClose();
              });
            }
          : undefined
      }
      onDelete={() => {
        void run(() => deleteMoment(getSupabase(), target)).then((ok) => {
          if (!ok) return;
          refreshToday();
          onClose();
          showToast('momentDeleted');
        });
      }}
      onClose={onClose}
    />
  );
}
