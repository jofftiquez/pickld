import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether to draw Liquid Glass (D-57): iOS 26 or later with the glass API, and Reduce Transparency off.
 * Kept up to date when the setting changes. False until Reduce Transparency is known, so a user who has it
 * on never sees glass flash in.
 */
export function useLiquidGlass(): boolean {
  return useLiquidGlassState() === true;
}

/**
 * The same answer, but null while Reduce Transparency is still being read on a phone that supports glass.
 * For a choice that can't change cheaply once drawn, such as which tab bar to mount (D-108).
 */
export function useLiquidGlassState(): boolean | null {
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
  if (!supported) return false;
  return reduceTransparency === null ? null : !reduceTransparency;
}
