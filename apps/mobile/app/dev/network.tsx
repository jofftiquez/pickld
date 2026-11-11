import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { parseDevOfflineParam, setDevOffline } from '@/lib/devOffline';

// Dev builds only: `pickld://dev/network?offline=1` makes the app behave as offline, `offline=0` turns
// that off (see devOffline.ts; Maestro's offline flow). Release builds redirect away and change nothing.
export default function DevNetworkRoute() {
  const { offline } = useLocalSearchParams<{ offline?: string }>();
  const next = parseDevOfflineParam(offline, __DEV__);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (next === null) return;
    let active = true;
    setDevOffline(next)
      .catch(() => undefined) // the switch is on for this run even if it couldn't be kept
      .finally(() => active && setDone(true));
    return () => {
      active = false;
    };
  }, [next]);

  if (next === null || done) return <Redirect href="/" />;
  return null;
}
