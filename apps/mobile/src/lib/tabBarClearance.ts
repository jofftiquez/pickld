import { createContext, useContext } from 'react';

import { sizes, space } from '@/theme/tokens';

/**
 * Extra bottom space a tab screen leaves for the tab bar, on top of the bottom safe-area inset.
 * The custom floating bar (D-52) is drawn over the screen, so screens clear it themselves. Under iOS 26's
 * native Liquid Glass tab bar (D-108) the screen's safe area already ends above the bar, so it is only the gap above the floating capsule.
 */
export const TabBarClearanceContext = createContext<number>(sizes.tabBar + space.lg);

export function useTabBarClearance(): number {
  return useContext(TabBarClearanceContext);
}
