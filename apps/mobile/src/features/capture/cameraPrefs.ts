// Camera preferences (QA item 25, D-66): kept on this phone only, in the local key-value store, never sent
// to the server. Not per account: they are about this phone's camera.
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';

const MIRROR_KEY = 'camera:mirrorSelfies';

/**
 * Mirror selfies: on (the default, as the iPhone Camera) saves a front-camera photo the way the preview
 * showed it, mirrored; off flips it back before it is queued. The preview stays mirrored either way.
 */
export async function getMirrorSelfies(): Promise<boolean> {
  return (await Storage.getItem(MIRROR_KEY)) !== 'off';
}

export async function setMirrorSelfies(on: boolean): Promise<void> {
  await Storage.setItem(MIRROR_KEY, on ? 'on' : 'off');
}

/** The Mirror selfies switch for Settings: on until the stored value has loaded, as it is by default. */
export function useMirrorSelfies(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    let alive = true;
    // A store that can't be read keeps the default.
    getMirrorSelfies()
      .then((value) => {
        if (alive) setOn(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const change = useCallback((value: boolean) => {
    setOn(value);
    // Not saved if the store fails: the switch still applies until the app restarts.
    setMirrorSelfies(value).catch(() => {});
  }, []);
  return [on, change];
}
