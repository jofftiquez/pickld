import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';

import { parseSlotParam } from '@/features/capture/cameraSlot';

// Capture tab (M2-07; FR-CAP-01). The camera is a full-screen route (`/camera`) above the tabs, so
// this tab only opens it. Hidden from the bar since D-52 (`href: null`); Today's tiles push `/camera`
// directly. Kept so the tab can come back. Coming back from the camera goes to Today.
export default function CaptureScreen() {
  const router = useRouter();
  const navigation = useNavigation<{ setParams(params: { slot?: string }): void }>();
  const { slot } = useLocalSearchParams<{ slot?: string }>();
  const opened = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (opened.current) {
        opened.current = false;
        router.navigate('/today');
        return;
      }
      opened.current = true;
      const target = parseSlotParam(slot);
      router.push(target ? { pathname: '/camera', params: { slot: target } } : '/camera');
      // Once the camera covers this tab, drop the tile's slot so the next tap on Capture doesn't reuse
      // it. Not before: a param change while focused would run this effect again.
      return () => {
        if (slot !== undefined) navigation.setParams({ slot: undefined });
      };
    }, [router, navigation, slot]),
  );

  return <View className="flex-1 bg-camera" testID="capture-launcher" />;
}
