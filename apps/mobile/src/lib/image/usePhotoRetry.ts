import { useEffect, useRef, useState } from 'react';

/**
 * How long to wait before each new try of a photo that failed to load. expo-image never tries again by
 * itself, so one failure (a dropped connection, the photo server restarting) left the blurred placeholder
 * on screen until the view remounted. Most such failures pass within seconds.
 */
export const PHOTO_RETRY_DELAYS_MS = [2000, 5000, 15000] as const;

/**
 * Tries a photo again after it fails to load. Pass the photo's identity (its object key), so a re-signed
 * link for the same photo keeps counting, and use `attempt` as the image's `key` so each try remounts it.
 */
export function usePhotoRetry(photoId: string | null): { attempt: number; onError: () => void } {
  const [state, setState] = useState({ photoId, attempt: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = state.photoId === photoId ? state.attempt : 0;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    [photoId],
  );

  const onError = () => {
    if (timer.current || attempt >= PHOTO_RETRY_DELAYS_MS.length) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      setState({ photoId, attempt: attempt + 1 });
    }, PHOTO_RETRY_DELAYS_MS[attempt]);
  };

  return { attempt, onError };
}
