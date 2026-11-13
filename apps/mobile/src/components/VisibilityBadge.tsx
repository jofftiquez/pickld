import { StyleSheet, View } from 'react-native';

import type { Visibility } from '@/lib/visibility';
import { colors, radius, sizes } from '@/theme/tokens';

import { Icon } from './Icon';
import type { IconName } from './icons';

/** The icon for each visibility (D-48): two people for Readers, a globe for Everyone, a lock for Only me. */
export const VISIBILITY_ICON = {
  readers: 'readers',
  everyone: 'globe',
  only_me: 'lock',
} as const satisfies Record<Visibility, IconName>;

export type VisibilityBadgeProps = {
  visibility: Visibility;
  /** `glass` over a photo on Today, `badge` (darker) on the small Publish review photos. */
  tone?: 'glass' | 'badge';
  iconSize?: number;
  testID?: string;
};

/**
 * The round visibility badge on a moment photo. Drawn only: the tile's own label says the visibility, so
 * the badge is hidden from screen readers and never the only way it is told (rule 11).
 */
export function VisibilityBadge({ visibility, tone = 'glass', iconSize = 14, testID }: VisibilityBadgeProps) {
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { backgroundColor: colors[tone] }]}
    >
      <Icon name={VISIBILITY_ICON[visibility]} color="surface" size={iconSize} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: sizes.lockBadge,
    height: sizes.lockBadge,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
