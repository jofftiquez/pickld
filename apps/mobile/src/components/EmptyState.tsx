import { StyleSheet, Text, View } from 'react-native';

import { maxTextScale, textStyle } from '@/theme/text';
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
  /** One row for an empty section inside a page (Explore): the icon on the left, the words beside it. */
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
  // A compact note inside a page stops growing at 2× so it doesn't push the page's content off screen.
  const maxScale = compact ? maxTextScale.control : undefined;
  return (
    <View style={[styles.root, compact && styles.compact]} testID={testID}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {illustration === 'jar' ? (
          <JarGraphic count={0} size={compact ? sizes.emptyWellCompact : sizes.emptyJar} decorative />
        ) : (
          <View style={[styles.well, compact && styles.wellRow, { width: well, height: well }]}>
            <Icon name={illustration} color="brandText" size={compact ? 22 : 28} />
          </View>
        )}
      </View>
      <View style={compact ? styles.compactText : styles.text}>
        <Text
          accessibilityRole="header"
          style={[textStyle(compact ? 'body' : 'sectionTitle', '700'), styles.title, compact && styles.start]}
          maxFontSizeMultiplier={maxScale}
        >
          {title}
        </Text>
        <Text
          style={[textStyle(compact ? 'bodySmall' : 'bodyMedium'), styles.body, compact && styles.start]}
          maxFontSizeMultiplier={maxScale}
        >
          {body}
        </Text>
      </View>
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
  compact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  text: { alignItems: 'center', gap: space.sm },
  compactText: { flex: 1, gap: 2 },
  start: { textAlign: 'left' },
  well: {
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  wellRow: { marginBottom: 0 },
  title: { color: colors.ink, textAlign: 'center' },
  body: { color: colors.inkSoft, textAlign: 'center' },
  action: { marginTop: space.sm, maxWidth: '100%' },
});
