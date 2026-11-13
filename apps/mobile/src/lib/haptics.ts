// Light haptics for the big moments (D-58): publish, filling a slot and liking. They stay on with Reduce
// Motion (it limits movement, not touch). A phone without a haptic engine, or one that refuses, is ignored.
import * as Haptics from 'expo-haptics';

/** A light tap: a slot fills, a like lands. */
export function tapHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** The day is published. */
export function successHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
