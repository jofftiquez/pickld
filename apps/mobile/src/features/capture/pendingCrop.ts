// The photo waiting on the Crop screen. The camera picks a gallery photo (M2-10) and works out its slot and
// jar date, or Moment options' Re-crop (M2-23) fetches a saved moment's photo, then opens /crop, which reads
// it here (a photo's URI and EXIF are too big and too untrusted for route params). Nothing changes until
// Done; Cancel leaves the gallery photo or the moment as it was, so nothing is lost.
import { create } from 'zustand';

import type { MomentTarget } from '@/features/moment/momentActions';
import type { Slot } from '@/theme/tokens';

import type { PickedPhoto } from './pickFromGallery';
import type { QueueTarget } from './saveCapture';

export type PendingCrop =
  | { photo: PickedPhoto; slot: Slot; userId: string; target: QueueTarget; recrop?: undefined }
  | {
      /** The moment's saved 3:4 photo; `temporary` when it was downloaded for this crop (deleted after). */
      photo: { uri: string; width: number; height: number; temporary: boolean };
      slot: Slot;
      userId: string;
      recrop: MomentTarget;
    };

type PendingCropState = {
  pending: PendingCrop | null;
  setPending: (pending: PendingCrop | null) => void;
};

export const usePendingCrop = create<PendingCropState>()((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));
