import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { PRESSED_OPACITY } from './BaseButton';
import type { GlassGlyph } from './GlassSurface';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type TabBarButtonProps = {
  icon: IconName;
  /** Already translated. */
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  /** The bar's glass shadows on Liquid Glass (D-80), else null (the milky blur). */
  glyph?: GlassGlyph | null;
  testID: string;
};

/** One tab of FloatingTabBar: icon in a pill (tinted when selected) over a caption. */
export function TabBarButton({ icon, label, focused, onPress, onLongPress, glyph = null, testID }: TabBarButtonProps) {
  const [pressed, setPressed] = useState(false);
  // The lighter glass lets dark content through, so unselected tabs use ink there instead of muted (D-80).
  const tint = focused ? 'brandText' : glyph ? 'ink' : 'muted';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[styles.tab, pressed ? { opacity: PRESSED_OPACITY } : null]}
    >
      <View
        // The selected pill is opaque; an unselected icon sits on the glass and gets its halo.
        style={[styles.pill, focused ? styles.pillActive : glyph?.icon]}
        testID={focused ? 'tab-active-pill' : undefined}
      >
        <Icon name={icon} color={tint} size={22} strokeWidth={focused ? 2 : 1.8} />
      </View>
      {/* Four tabs share the bar (D-130): a label stays on one line and shrinks a little rather than wrap. */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={maxTextScale.tabLabel}
        style={[textStyle('caption', focused ? '700' : '600'), { color: colors[tint] }, glyph?.text, styles.label]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    // A whole column of the bar is the target: 68 tall, a quarter of the bar wide.
    minHeight: sizes.tabBar,
    minWidth: sizes.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes.tabIconLabelGap,
    paddingVertical: space.xs,
  },
  pill: {
    width: sizes.tabPillWidth,
    height: sizes.tabPillHeight,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.brandTint },
  label: { textAlign: 'center' },
});
