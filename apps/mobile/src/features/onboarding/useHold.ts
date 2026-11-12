import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the Pickld Promise must be held (FR-ONB-07). */
export const HOLD_MS = 1500;

/**
 * Hold to confirm: `press` starts the timer, `release` before it ends cancels it, and `onDone` runs once
 * when it ends (releasing afterwards changes nothing). `confirm` finishes at once, for screen readers,
 * whose double tap can't hold. `holding` drives the progress ring. When `onDone` resolves false (a failed
 * save), the next hold tries again.
 */
export function useHold(onDone: () => void | Promise<boolean>, duration = HOLD_MS) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  }, [onDone]);

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const finish = useCallback(() => {
    clear();
    if (done.current) return;
    done.current = true;
    void Promise.resolve(latest.current()).then((ok) => {
      // A failed save (false) lets the next hold try again.
      if (ok === false) {
        done.current = false;
        setHolding(false);
      }
    });
  }, []);

  const press = useCallback(() => {
    if (done.current) return;
    clear();
    setHolding(true);
    timer.current = setTimeout(finish, duration);
  }, [duration, finish]);

  const release = useCallback(() => {
    clear();
    if (!done.current) setHolding(false);
  }, []);

  useEffect(() => clear, []);

  return { holding, press, release, confirm: finish };
}
