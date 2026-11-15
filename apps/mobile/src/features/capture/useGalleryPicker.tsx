import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Modal } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { captureError } from '@/lib/monitoring';
import { useReduceMotion } from '@/lib/useReduceMotion';

import { GalleryGrid } from './GalleryGrid';
import { askLibraryAccess, libraryAccess, type LibraryAccess } from './libraryPhotos';
import { pickFromGallery, type PickedPhoto } from './pickFromGallery';

type Resolve = (photo: PickedPhoto | null) => void;

/** Longest wait for the grid to slide away before the next screen (Crop, the editor, Apple's picker) opens. */
const DISMISS_MS = 600;

/**
 * The gallery of the camera and of a past day's page (FR-CAP-02, D-153): `pick()` resolves with the chosen
 * photo, or null on Close or cancel. With Photos access (iOS), it opens the in-app grid with dates
 * (`GalleryGrid`); without it, on Android, or when the library can't be read, it opens the system picker.
 * The camera never asks for access; with `askOnce` (the day page) Apple's prompt is shown once while access
 * was never decided. Render `modal` next to the screen; `open` is true while the grid shows.
 */
export function useGalleryPicker(input: { tz: string; target: string | null; insets: EdgeInsets; askOnce?: boolean }): {
  pick: () => Promise<PickedPhoto | null>;
  open: boolean;
  modal: ReactElement;
} {
  const reduceMotion = useReduceMotion();
  const [access, setAccess] = useState<LibraryAccess>('all');
  const [open, setOpen] = useState(false);
  const answer = useRef<Resolve | null>(null);
  const afterDismiss = useRef<(() => void) | null>(null);

  // Leaving the screen with the grid open counts as Close.
  useEffect(() => () => answer.current?.(null), []);

  const askOnce = input.askOnce ?? false;
  const pick = useCallback(async (): Promise<PickedPhoto | null> => {
    const granted = await (askOnce ? askLibraryAccess() : libraryAccess()).catch((error: unknown) => {
      captureError(error, { area: 'gallery' });
      return null;
    });
    if (granted === null) return pickFromGallery();
    return new Promise<PickedPhoto | null>((resolve) => {
      answer.current?.(null);
      answer.current = resolve;
      setAccess(granted);
      setOpen(true);
    });
  }, [askOnce]);

  // Closes the grid, then settles once it has gone, so the next screen isn't presented over a closing one.
  const finish = useCallback((next: (resolve: Resolve) => void) => {
    const resolve = answer.current;
    answer.current = null;
    if (!resolve) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      afterDismiss.current = null;
      next(resolve);
    };
    timer = setTimeout(run, DISMISS_MS);
    afterDismiss.current = run;
    setOpen(false);
  }, []);

  const onPick = useCallback((photo: PickedPhoto) => finish((resolve) => resolve(photo)), [finish]);
  const onClose = useCallback(() => finish((resolve) => resolve(null)), [finish]);
  const onUnavailable = useCallback(
    () =>
      finish((resolve) => {
        pickFromGallery().then(resolve, (error: unknown) => {
          captureError(error, { area: 'gallery' });
          resolve(null);
        });
      }),
    [finish],
  );

  const modal = (
    <Modal
      visible={open}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={() => afterDismiss.current?.()}
    >
      {open ? (
        <GalleryGrid
          access={access}
          tz={input.tz}
          target={input.target}
          insets={input.insets}
          onPick={onPick}
          onClose={onClose}
          onUnavailable={onUnavailable}
        />
      ) : null}
    </Modal>
  );
  return { pick, open, modal };
}
