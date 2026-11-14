import { StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { JarGraphic } from './JarGraphic';
import { PillButton } from './PillButton';
import { PullToRefreshHint } from './PullToRefreshHint';

export type EmptyStateProps = {
  /** An icon in a tinted circle, or `jar` for the empty jar graphic. */
  illustration: IconName | 'jar';
  title: string;
  body: string;
  /** What to do next, when there is something (Find people, Add a moment). */
  action?: { label: string; onPress: () => void; accessibilityHint?: string; testID?: string };
  /** The list refreshes when pulled down: adds the muted "Pull down to refresh" hint. */
  refreshable?: boolean;
  /** Smaller, for an empty section inside a page (Explore). */
  compact?: boolean;
  testID?: string;
};

/**
 * An empty list (D-87): a small illustration, a title, one helpful line, an action where one exists, and on
 * lists that refresh when pulled, a hint saying so. Put it inside the refreshable scroll so pulling works.
 */
export function EmptyState({
  illustration,
  title,
  body,
  action,
  refreshable = false,
  compact = false,
  testID,
}: EmptyStateProps) {
  const well = compact ? sizes.emptyWellCompact : sizes.emptyWell;
  return (
    <View style={[styles.root, compact && styles.compact]} testID={testID}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {illustration === 'jar' ? (
          <JarGraphic count={0} size={compact ? sizes.emptyWellCompact : sizes.emptyJar} decorative />
        ) : (
          <View style={[styles.well, { width: well, height: well }]}>
            <Icon name={illustration} color="brandText" size={compact ? 22 : 28} />
          </View>
        )}
      </View>
      <Text accessibilityRole="header" style={[textStyle(compact ? 'body' : 'sectionTitle', '700'), styles.title]}>
        {title}
      </Text>
      <Text style={[textStyle(compact ? 'bodySmall' : 'bodyMedium'), styles.body]}>{body}</Text>
      {action ? (
        <View style={styles.action}>
          <PillButton
            label={action.label}
            accessibilityHint={action.accessibilityHint}
            onPress={action.onPress}
            testID={action.testID}
          />
        </View>
      ) : null}
      {refreshable ? <PullToRefreshHint testID={testID ? `${testID}-refresh-hint` : undefined} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xxl,
    paddingBottom: space.xl,
    paddingHorizontal: space.xl,
  },
  compact: { paddingTop: space.md, paddingBottom: space.sm, gap: space.xs },
  well: {
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  title: { color: colors.ink, textAlign: 'center' },
  body: { color: colors.inkSoft, textAlign: 'center' },
  action: { marginTop: space.sm, maxWidth: '100%' },
});
