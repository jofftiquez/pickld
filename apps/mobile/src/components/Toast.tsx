import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TOAST_DURATION_MS } from '@/lib/toast';
import { textStyle } from '@/theme/text';
import { colors, motion, radius, shadow, sizes, space } from '@/theme/tokens';

import { Icon } from './Icon';
import type { IconName } from './icons';

/** How far the toast slides down into place (it fades in at the same time). */
export const TOAST_SLIDE = sizes.minTap * 2;
/** Dragging the toast up past this many points lets it go. */
const SWIPE_TO_DISMISS = sizes.minTap / 2;

export type ToastAction = { label: string; onPress: () => void };

export type ToastProps = {
  /** Already translated, one line at normal text sizes. Never a photo or caption (rules 9, 10). */
  message: string;
  /** Defaults to a check mark. */
  icon?: IconName;
  /** Room for a later Undo (D-63); nothing passes one yet. */
  action?: ToastAction;
  /** Runs once the toast has left: after its time, a swipe up, or the screen reader's dismiss. Keep it
   * stable (useCallback): a new function restarts the toast's timer. */
  onHidden: () => void;
  durationMs?: number;
  testID?: string;
};

/**
 * Success toast (D-63): a short pill under the status bar with an icon and one line. It slides in (fades
 * with Reduce Motion), is read aloud by the screen reader, leaves after about 2.5 s, and can be swiped up.
 * ToastHost places it and shows the latest `showToast`; a new toast mounts a new Toast in its place.
 */
export function Toast({
  message,
  icon = 'check',
  action,
  onHidden,
  durationMs = TOAST_DURATION_MS,
  testID,
}: ToastProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  const leaving = useRef(false);

  const hide = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    shown.set(
      withTiming(0, { duration: motion.fast }, (finished) => {
        if (finished) scheduleOnRN(onHidden);
      }),
    );
  }, [shown, onHidden]);

  useEffect(() => {
    shown.set(withTiming(1, { duration: motion.base }));
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(hide, durationMs);
    return () => clearTimeout(timer);
  }, [shown, hide, message, durationMs]);

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    testID: `${testID ?? 'toast'}-pan`,
    onUpdate: (e) => {
      drag.set(Math.min(0, e.translationY));
    },
    onDeactivate: (e) => {
      if (e.translationY < -SWIPE_TO_DISMISS) hide();
      else drag.set(withTiming(0, { duration: motion.fast }));
    },
  });

  // Reduce Motion: only the fade; the pill moves only when dragged.
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (reduceMotion ? 0 : (1 - shown.value) * -TOAST_SLIDE) + drag.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.pill, style]}
        accessible={!action}
        accessibilityLabel={message}
        accessibilityActions={[{ name: 'dismiss', label: t('common.close') }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'dismiss') hide();
        }}
        onAccessibilityEscape={hide}
        testID={testID ?? 'toast'}
      >
        <Icon name={icon} color="brand" size={20} strokeWidth={2.4} />
        <Text style={[textStyle('bodyMedium', '700'), styles.message]}>{message}</Text>
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              hide();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={styles.actionButton}
            testID={`${testID ?? 'toast'}-action`}
          >
            <Text style={[textStyle('bodyMedium', '800'), styles.action]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.sm,
    minHeight: sizes.minTap,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    ...shadow.floating,
  },
  message: { color: colors.surface, flexShrink: 1 },
  actionButton: { minWidth: sizes.minTap, minHeight: sizes.minTap, justifyContent: 'center', alignItems: 'center' },
  action: { color: colors.brandTint },
});
