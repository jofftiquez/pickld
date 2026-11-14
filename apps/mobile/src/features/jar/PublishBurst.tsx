import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ConfettiBurst } from './ConfettiBurst';

/**
 * The confetti over Today or the day page after Publish (D-58, D-77, D-132): thrown up out of the jar card, it
 * falls and fades on its own. With Reduce Motion there is no confetti; the lid's fade on the jar card stays.
 */
export function PublishBurst() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="publish-burst">
      <ConfettiBurst />
    </View>
  );
}
