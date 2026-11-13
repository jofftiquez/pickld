import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether to draw Liquid Glass (D-57): iOS 26 or later with the glass API, and Reduce Transparency off.
 * Kept up to date when the setting changes. False until Reduce Transparency is known, so a user who has it
 * on never sees glass flash in.
 */
export function useLiquidGlass(): boolean {
  const supported = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const [reduceTransparency, setReduceTransparency] = useState<boolean | null>(null);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (alive) setReduceTransparency(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [supported]);
  return supported && reduceTransparency === false;
}
