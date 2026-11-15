import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { FloatingTabBar, mainTabs, type MainTab } from '@/components/FloatingTabBar';
import { useDiscoverUnread, useJarsUnread, useMomentsUnread } from '@/features/feed/useTabUnread';
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

// What VoiceOver reads for a tab with a dot: after its name in the custom bar ("new moments"), and as the whole
// label in the system bar, whose badge has no spoken text ("Moments, new moments").
const unreadText = {
  moments: { value: 'tabs.momentsNew', label: 'tabs.momentsUnread' },
  jars: { value: 'tabs.jarsNew', label: 'tabs.jarsUnread' },
  discover: { value: 'tabs.discoverNew', label: 'tabs.discoverUnread' },
} as const satisfies Partial<Record<MainTab, { value: `tabs.${string}`; label: `tabs.${string}` }>>;

type UnreadTab = keyof typeof unreadText;

// Main tab shell (design: Main; D-52, D-130): Today | Moments | Jars | Discover; screen order sets tab order. My days is a stack
// screen (app/my-days.tsx) opened from Today's calendar button.
// iOS 26+ with glass allowed gets the system's floating Liquid Glass tab bar, the selected tab on a lighter glass
// pill (D-108). Older iOS, and Reduce Transparency, keep the custom FloatingTabBar.
export default function TabsLayout() {
  const { t } = useTranslation();
  const glass = useLiquidGlassState();
  // A red dot on Moments, Jars and Discover while each has something from someone else newer than the newest
  // one seen there (FR-EXP-04, D-157); a tab's dot clears while it is open.
  const pathname = usePathname();
  const unread: Record<UnreadTab, boolean> = {
    moments: useMomentsUnread(pathname === '/moments'),
    jars: useJarsUnread(pathname === '/jars'),
    discover: useDiscoverUnread(pathname === '/discover'),
  };
  const isUnread = (name: MainTab): name is UnreadTab => name in unread && unread[name as UnreadTab];
  // Wait for Reduce Transparency before choosing, so the bar (and each tab's state) mounts once.
  if (glass === null) return null;
  if (glass) {
    return (
      <TabBarClearanceContext.Provider value={space.lg}>
        <NativeTabs tintColor={colors.brandText} badgeBackgroundColor={colors.unreadDot} minimizeBehavior="never">
          {(Object.keys(mainTabs) as (keyof typeof mainTabs)[]).map((name) => (
            // The screens pad for the safe area themselves, which here already ends above the bar.
            <NativeTabs.Trigger
              key={name}
              name={name}
              disableAutomaticContentInsets
              // The system badge has no spoken text, so the label says it ("Moments, new moments").
              accessibilityLabel={isUnread(name) ? t(unreadText[name].label) : t(mainTabs[name].label)}
              testID={`tab-${name}`}
            >
              <NativeTabs.Trigger.Icon src={nativeIcons[name]} renderingMode="template" />
              <NativeTabs.Trigger.Label>{t(mainTabs[name].label)}</NativeTabs.Trigger.Label>
              {/* No text: the system draws an empty badge, a dot. */}
              <NativeTabs.Trigger.Badge hidden={!isUnread(name)} />
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
        <FloatingTabBar
          {...props}
          badges={Object.fromEntries(
            (Object.keys(unreadText) as UnreadTab[]).flatMap((name) =>
              unread[name] ? [[name, t(unreadText[name].value)]] : [],
            ),
          )}
        />
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
