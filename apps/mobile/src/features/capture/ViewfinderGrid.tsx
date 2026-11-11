import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

const THIRDS = ['33.333%', '66.666%'] as const;

/** Rule-of-thirds lines over the viewfinder (Camera). Decorative: hidden from screen readers. */
export function ViewfinderGrid() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="viewfinder-grid"
    >
      {THIRDS.map((at) => (
        <View key={`v${at}`} style={[styles.vertical, { left: at }]} />
      ))}
      {THIRDS.map((at) => (
        <View key={`h${at}`} style={[styles.horizontal, { top: at }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.cameraGrid,
  },
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.cameraGrid,
  },
});
