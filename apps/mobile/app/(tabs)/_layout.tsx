import { Tabs } from 'expo-router/js-tabs';

import { FloatingTabBar } from '@/components/FloatingTabBar';

// Main tab shell (design: Main; D-52): Today | Moments | Jars. The floating bar is drawn by FloatingTabBar; screen
// order sets tab order. My days is a stack screen (app/my-days.tsx) opened from Today's calendar button.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="moments" />
      {/* Hidden, not deleted (D-52): Today's tiles open /camera?slot=… directly. */}
      <Tabs.Screen name="capture" options={{ href: null }} />
      <Tabs.Screen name="jars" />
    </Tabs>
  );
}
