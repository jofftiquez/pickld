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
import { MomentOptionsSheet } from './MomentOptionsSheet';
import { openRecrop } from './recrop';

export type MomentOptionsSelection = { tile: GridTile; target: MomentTarget };

export type MomentOptionsProps = {
  visible: boolean;
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
 * Moment options on Today (M2-23, FR-CAP-10). Visibility, Move and Delete apply here and Today refreshes
 * underneath; Edit caption and Edit stickers and filters open the editor, Re-crop the Crop screen. See
 * momentActions.ts for what each does to a queued or an uploaded moment.
 */
export function MomentOptions({ visible, selection, userId, freeSlots, tz, onClose }: MomentOptionsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const { tile, target } = selection;
  // A queued photo left at the owner's default shows that default; Readers until the profile has loaded.
  const [visibility, setVisibility] = useState<Visibility>(
    () => tile.visibility ?? queryClient.getQueryData<Me>(todayQueryKeys.me(userId))?.defaultVisibility ?? 'readers',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OptionError | null>(null);

  const refreshToday = () => {
    void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
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
        });
      }}
      onDelete={() => {
        void run(() => deleteMoment(getSupabase(), target)).then((ok) => {
          if (!ok) return;
          refreshToday();
          onClose();
        });
      }}
      onClose={onClose}
    />
  );
}
