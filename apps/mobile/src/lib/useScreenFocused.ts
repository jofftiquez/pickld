import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Whether this screen is in front (not behind a pushed screen or modal). False until it first focuses. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
