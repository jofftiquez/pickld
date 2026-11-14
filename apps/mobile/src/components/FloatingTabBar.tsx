import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useLiquidGlass } from '@/lib/useLiquidGlass';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { GlassSurface } from './GlassSurface';
import type { IconName } from './icons';
import { TabBarButton } from './TabBarButton';

/**
 * The main tabs, keyed by route name under `app/(tabs)/` (D-52, D-130): Today | Moments | Jars | Discover; only
 * the selected tab is highlighted. Routes not listed here (the hidden Capture route) get no tab.
 */
export const mainTabs = {
  today: { icon: 'today', label: 'tabs.today' },
  moments: { icon: 'moments', label: 'tabs.moments' },
  jars: { icon: 'jars', label: 'tabs.jars' },
  discover: { icon: 'compass', label: 'tabs.discover' },
} as const satisfies Record<string, { icon: IconName; label: `tabs.${string}` }>;

export type MainTab = keyof typeof mainTabs;

export type FloatingTabBarProps = BottomTabBarProps & {
  /** Tabs that show a small dot, each with what VoiceOver reads after the tab's name ("new posts"). Translated. */
  badges?: Partial<Record<MainTab, string>>;
};

function isMainTab(name: string): name is MainTab {
  return name in mainTabs;
}

/**
 * Custom `tabBar` for the Expo Router `Tabs` in `app/(tabs)/_layout.tsx` (design: Main).
 * Floats over the screen, inset from the edges and above the home indicator. Lightly tinted Liquid Glass on
 * iOS 26 (D-80), the milky frosted blur below that or with Reduce Transparency on (D-57).
 */
export function FloatingTabBar({ state, emitter, navigateToTab, insets, badges }: FloatingTabBarProps) {
  const { t } = useTranslation();
  const glass = useLiquidGlass();
  return (
    <View
      style={[
        styles.outer,
        // The blur look's milky fill sits here so the shadow has a shape; glass carries it as its tint.
        glass ? null : styles.fill,
        {
          left: space.md + insets.left,
          right: space.md + insets.right,
          bottom: Math.max(insets.bottom, space.lg),
        },
      ]}
      testID="floating-tab-bar"
    >
      {/* Separate from the outer view so the clip doesn't cut off the iOS shadow. */}
      {/* Lightly tinted so the glass shows (D-80); the labels get ink and a halo on it instead. */}
      <GlassSurface
        tone="light"
        radius={radius.tabBar}
        tint={colors.liquidTabBarTint}
        interactive
        blurIntensity={40}
        testID="tab-bar"
      >
        {(glyph) => (
          <View accessibilityRole="tablist" accessibilityLabel={t('tabs.label')} style={styles.row}>
            {state.routes.map((route, index) => {
              if (!isMainTab(route.name)) return null;
              const focused = index === state.index;
              const onPress = () => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              };
              const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
              return (
                <TabBarButton
                  key={route.key}
                  icon={mainTabs[route.name].icon}
                  label={t(mainTabs[route.name].label)}
                  focused={focused}
                  badge={badges?.[route.name]}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  glyph={glyph}
                  testID={`tab-${route.name}`}
                />
              );
            })}
          </View>
        )}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    borderRadius: radius.tabBar,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.tabBarBorder,
    ...shadow.floating,
  },
  fill: { backgroundColor: colors.tabBarGlass },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.tabBar },
});
