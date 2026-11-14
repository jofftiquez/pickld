// The back-to-top button on the paged feeds (Jars, Moments, Discover; NFR-PERF-02). It shows once the reader is
// a couple of screens down. Near the top it scrolls back up; far down it jumps to the top and the screen reloads
// the newest page instead, because scrolling past dozens of photo cards is slow and blank, the deep pages hold
// memory and stale links, and whoever scrolled that far has likely missed new posts.
import { useCallback, useRef, useState } from 'react';
import { useWindowDimensions, type FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

/** Screens scrolled before the button shows. */
export const SHOW_AFTER_SCREENS = 2;
/** Screens scrolled past which the button reloads the newest page instead of scrolling back. */
export const RELOAD_AFTER_SCREENS = 8;

export type BackToTopMode = 'scroll' | 'reload';

/** What the button does at `offset` points down a list whose screen is `viewport` points tall. */
export function backToTopMode(offset: number, viewport: number): BackToTopMode {
  return offset > RELOAD_AFTER_SCREENS * viewport ? 'reload' : 'scroll';
}

/**
 * Wires a FlatList to the button: pass `listRef`, `onScroll` and `scrollEventThrottle` to the list, show the
 * button while `showBackToTop`, and call `backToTop` when it is pressed. `onBackToTop` hears the mode after the list
 * is back at the top; on `reload` the screen trims its pages to the first and fetches it again.
 */
export function useBackToTop<T>(onBackToTop: (mode: BackToTopMode) => void) {
  const listRef = useRef<FlatList<T>>(null);
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const offset = useRef(0);
  const [visible, setVisible] = useState(false);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
      const show = offset.current > SHOW_AFTER_SCREENS * height;
      setVisible((was) => (was === show ? was : show));
    },
    [height],
  );

  const backToTop = () => {
    const mode = backToTopMode(offset.current, height);
    listRef.current?.scrollToOffset({ offset: 0, animated: mode === 'scroll' && !reduceMotion });
    offset.current = 0;
    setVisible(false);
    onBackToTop(mode);
  };

  return { listRef, onScroll, scrollEventThrottle: 100, showBackToTop: visible, backToTop };
}
