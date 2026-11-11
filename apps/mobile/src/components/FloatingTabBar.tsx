import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import type { IconName } from './icons';
import { TabBarButton } from './TabBarButton';

/** The four main tabs, keyed by route name under `app/(tabs)/`. */
export const mainTabs = {
  today: { icon: 'today', label: 'tabs.today' },
  capture: { icon: 'capture', label: 'tabs.capture' },
  jars: { icon: 'jars', label: 'tabs.jars' },
  'my-days': { icon: 'myDays', label: 'tabs.myDays' },
} as const satisfies Record<string, { icon: IconName; label: `tabs.${string}` }>;

type MainTab = keyof typeof mainTabs;

function isMainTab(name: string): name is MainTab {
  return name in mainTabs;
}

/**
 * Custom `tabBar` for the Expo Router `Tabs` in `app/(tabs)/_layout.tsx` (design: Main).
 * Floats over the screen, inset from the edges and above the home indicator.
 */
export function FloatingTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.outer,
        {
          left: space.md + insets.left,
          right: space.md + insets.right,
          bottom: Math.max(insets.bottom, space.lg),
        },
      ]}
      testID="floating-tab-bar"
    >
      <View style={styles.clip}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} testID="tab-bar-blur" />
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
                onPress={onPress}
                onLongPress={onLongPress}
                testID={`tab-${route.name}`}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    borderRadius: radius.tabBar,
    backgroundColor: colors.tabBarGlass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.tabBarBorder,
    ...shadow.floating,
  },
  // Separate from `outer` so the clip doesn't cut off the iOS shadow.
  clip: { borderRadius: radius.tabBar, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.tabBar },
});
