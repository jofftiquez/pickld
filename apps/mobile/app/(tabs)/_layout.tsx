import { Tabs } from 'expo-router/js-tabs';

import { FloatingTabBar } from '@/components/FloatingTabBar';

// Main tab shell (design: Main). The floating bar is drawn by FloatingTabBar; screen order sets tab order.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="capture" />
      <Tabs.Screen name="jars" />
      <Tabs.Screen name="my-days" />
    </Tabs>
  );
}
