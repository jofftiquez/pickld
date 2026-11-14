import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { FloatingTabBar, mainTabs } from '@/components/FloatingTabBar';
import { useDiscoverUnread } from '@/features/explore/useDiscoverUnread';
import { TabBarClearanceContext } from '@/lib/tabBarClearance';
import { useLiquidGlassState } from '@/lib/useLiquidGlass';
import { colors, space } from '@/theme/tokens';

// Template images rendered from the app's own stroke icons by scripts/render-tab-icons.mjs, so both bars use the
// same Today, Moments, Jars and Discover glyphs.
const nativeIcons = {
  today: require('../../assets/tabs/today.png'),
  moments: require('../../assets/tabs/moments.png'),
  jars: require('../../assets/tabs/jars.png'),
  discover: require('../../assets/tabs/discover.png'),
} as const satisfies Record<keyof typeof mainTabs, number>;

// Main tab shell (design: Main; D-52, D-130): Today | Moments | Jars | Discover; screen order sets tab order. My days is a stack
// screen (app/my-days.tsx) opened from Today's calendar button.
// iOS 26+ with glass allowed gets the system's floating Liquid Glass tab bar, the selected tab on a lighter glass
// pill (D-108). Older iOS, and Reduce Transparency, keep the custom FloatingTabBar.
export default function TabsLayout() {
  const { t } = useTranslation();
  const glass = useLiquidGlassState();
  // A dot on Discover while it has posts newer than the newest one seen there (FR-EXP-04).
  const discoverUnread = useDiscoverUnread(usePathname() === '/discover');
  // Wait for Reduce Transparency before choosing, so the bar (and each tab's state) mounts once.
  if (glass === null) return null;
  if (glass) {
    return (
      <TabBarClearanceContext.Provider value={space.lg}>
        <NativeTabs tintColor={colors.brandText} badgeBackgroundColor={colors.notifyDot} minimizeBehavior="never">
          {(Object.keys(mainTabs) as (keyof typeof mainTabs)[]).map((name) => (
            // The screens pad for the safe area themselves, which here already ends above the bar.
            <NativeTabs.Trigger
              key={name}
              name={name}
              disableAutomaticContentInsets
              // The system badge has no spoken text, so the label says it ("Discover, new posts").
              accessibilityLabel={
                name === 'discover' && discoverUnread ? t('tabs.discoverUnread') : t(mainTabs[name].label)
              }
              testID={`tab-${name}`}
            >
              <NativeTabs.Trigger.Icon src={nativeIcons[name]} renderingMode="template" />
              <NativeTabs.Trigger.Label>{t(mainTabs[name].label)}</NativeTabs.Trigger.Label>
              {/* No text: the system draws an empty badge, a dot. */}
              <NativeTabs.Trigger.Badge hidden={!(name === 'discover' && discoverUnread)} />
            </NativeTabs.Trigger>
          ))}
          {/* Hidden, not deleted (D-52): Today's tiles open /camera?slot=… directly. */}
          <NativeTabs.Trigger name="capture" hidden />
        </NativeTabs>
      </TabBarClearanceContext.Provider>
    );
  }
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <FloatingTabBar {...props} badges={discoverUnread ? { discover: t('tabs.discoverNew') } : undefined} />
      )}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="moments" />
      {/* Hidden, not deleted (D-52): Today's tiles open /camera?slot=… directly. */}
      <Tabs.Screen name="capture" options={{ href: null }} />
      <Tabs.Screen name="jars" />
      <Tabs.Screen name="discover" />
    </Tabs>
  );
}
