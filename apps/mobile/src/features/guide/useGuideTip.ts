// Picks the tip a screen shows (FR-ONB-10). A screen lists its tips in order, each with when it applies; the
// first that applies and hasn't been shown opens while the screen is in front. At most one opens per visit: the
// next waits until the screen opens again. A tip counts as shown the moment it opens, so leaving the screen or
// quitting doesn't bring it back, and it closes for good once it no longer applies (the screen left the front,
// a sheet opened). Like the First moment tip, it waits for a toast on screen to leave.
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import type { GestureResponderEvent, View } from 'react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { useToastStore } from '@/lib/toast';

import { loadGuideTips, markGuideTipSeen, turnOffGuideTips, useGuideStore, type GuideTipId } from './guideTips';

export type GuideTipCandidate = { id: GuideTipId; when: boolean };
export type GuideTipClose = 'got_it' | 'tap' | 'turn_off';

export type GuideTipState = {
  /** The tip on screen, or null. */
  tip: GuideTipId | null;
  close: (how: GuideTipClose) => void;
  /** On the tip card, so a tap elsewhere can tell it missed the card. */
  tipRef: RefObject<ComponentRef<typeof View> | null>;
  /** On the screen's root view: a tap outside the tip closes it, and still reaches what was tapped. Scrolling
   * doesn't close it. */
  catchTaps: {
    onTouchStartCapture: (e: GestureResponderEvent) => void;
    onTouchEndCapture: (e: GestureResponderEvent) => void;
  };
};

/** A touch that moved less than this is a tap, not a scroll. */
const TAP_SLOP = 10;

export function useGuideTip(candidates: readonly GuideTipCandidate[], focused: boolean): GuideTipState {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const loadedFor = useGuideStore((s) => s.userId);
  const on = useGuideStore((s) => s.on);
  const seen = useGuideStore((s) => s.seen);
  const toastUp = useToastStore((s) => s.current !== null);
  const [tip, setTip] = useState<GuideTipId | null>(null);
  const [shownThisVisit, setShownThisVisit] = useState(false);
  const tipRef = useRef<ComponentRef<typeof View>>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Read from the phone once a screen with tips is first in front.
  useEffect(() => {
    if (userId && focused) void loadGuideTips(userId);
  }, [userId, focused]);

  // Both during render. No longer applies while up: close it now (it already counted as shown). Leaving the
  // screen starts a new visit.
  const applies = (id: GuideTipId) => candidates.some((c) => c.id === id && c.when);
  if (tip !== null && (!focused || !applies(tip))) setTip(null);
  if (!focused && shownThisVisit) setShownThisVisit(false);

  const next =
    focused && userId !== null && loadedFor === userId && on && !toastUp && tip === null && !shownThisVisit
      ? (candidates.find((c) => c.when && !seen.includes(c.id))?.id ?? null)
      : null;
  if (next !== null) {
    setTip(next);
    setShownThisVisit(true);
  }
  useEffect(() => {
    if (tip !== null && userId !== null) void markGuideTipSeen(userId, tip);
  }, [tip, userId]);

  const close = (how: GuideTipClose) => {
    if (tip === null) return;
    track('guide_tip_closed', { tip, how });
    setTip(null);
    if (how === 'turn_off' && userId) void turnOffGuideTips(userId);
  };

  const catchTaps = {
    onTouchStartCapture: (e: GestureResponderEvent) => {
      touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onTouchEndCapture: (e: GestureResponderEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (tip === null || !start) return;
      const { pageX, pageY } = e.nativeEvent;
      if (Math.hypot(pageX - start.x, pageY - start.y) > TAP_SLOP) return;
      tipRef.current?.measureInWindow((x, y, width, height) => {
        const inside = pageX >= x && pageX <= x + width && pageY >= y && pageY <= y + height;
        if (!inside) close('tap');
      });
    },
  };

  return { tip, close, tipRef, catchTaps };
}
