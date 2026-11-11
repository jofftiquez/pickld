// The gallery photo waiting on the Crop screen (M2-10). The camera picks it and works out its slot and jar
// date, then opens /crop, which reads it here (a photo's URI and EXIF are too big and too untrusted for
// route params). Nothing is queued until Done; Cancel leaves the photo in the gallery, so nothing is lost.
import { create } from 'zustand';

import type { Slot } from '@/theme/tokens';

import type { PickedPhoto } from './pickFromGallery';
import type { QueueTarget } from './saveCapture';

export type PendingCrop = { photo: PickedPhoto; slot: Slot; userId: string; target: QueueTarget };

type PendingCropState = {
  pending: PendingCrop | null;
  setPending: (pending: PendingCrop | null) => void;
};

export const usePendingCrop = create<PendingCropState>()((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));
