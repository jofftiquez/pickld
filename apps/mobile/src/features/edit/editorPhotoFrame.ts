import { StyleSheet, useWindowDimensions } from 'react-native';
import { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/useReduceMotion';
import { colors, photo, radius, sizes, space } from '@/theme/tokens';

// Room below the photo for the tool tabs and the filter row; the photo shrinks on short phones so they
// fit. Taller tools (Stickers, Text with the keyboard up) and large text scroll the screen.
const PANEL_MIN_HEIGHT = 260;

// Parallax (item 14, kept on the photo step by D-105): while the panel scrolls up over it, the photo moves
// up at 40% of the scroll speed and shrinks to 92%, so its top stays in view under the toolbar.
const PHOTO_SCROLL_SPEED = 0.4;
const PHOTO_MIN_SCALE = 0.92;
// The panel can scroll up until this much of the photo's height is left showing between the toolbar and
// the panel; the panel is at least tall enough to allow it.
const PHOTO_PEEK = 0.25;

/**
 * The editor's photo as both steps show it: the 3:4 photo as large as fits under the toolbar with room for
 * the panel, and the panel scrolling up over it with the parallax. Both steps use it, so the photo keeps its
 * size and place from the photo step to the caption.
 */
export function useEditorPhotoFrame(toolbarHeight: number) {
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const available = window.height - toolbarHeight - PANEL_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);
  const height = width / photo.aspect;
  const panelMinHeight = Math.max(PANEL_MIN_HEIGHT, window.height - toolbarHeight - Math.round(height * PHOTO_PEEK));
  /** The scroll offset that slides the panel all the way up, leaving the photo's peek showing. */
  const panelTop = Math.round(height * (1 - PHOTO_PEEK));

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  // The photo scrolls with the content, so it is pushed back down by the part of the scroll it skips.
  // Pulling down past the top (bounce) moves it with the content. Reduce Motion: a plain scroll.
  const photoMotion = useAnimatedStyle(() => {
    if (reduceMotion || height <= 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const scrolled = Math.max(0, scrollY.get());
    const progress = Math.min(1, scrolled / height);
    return {
      transform: [{ translateY: scrolled * (1 - PHOTO_SCROLL_SPEED) }, { scale: 1 - (1 - PHOTO_MIN_SCALE) * progress }],
    };
  });

  return { width, height, panelMinHeight, panelTop, onScroll, photoMotion, reduceMotion };
}

export const editorPhotoStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.editor },
  content: { flexGrow: 1 },
  photo: {
    alignSelf: 'center',
    // The parallax shrinks it toward its top edge, which stays under the toolbar.
    transformOrigin: 'top',
    overflow: 'hidden',
    backgroundColor: colors.editorPhoto,
    borderBottomLeftRadius: radius.editorPhoto,
    borderBottomRightRadius: radius.editorPhoto,
  },
  // After the photo, so it draws over it (and takes the taps) as it slides up.
  panel: {
    flex: 1,
    marginTop: -sizes.editorPanelOverlap,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.lg + 2,
    paddingHorizontal: space.xl,
  },
});
