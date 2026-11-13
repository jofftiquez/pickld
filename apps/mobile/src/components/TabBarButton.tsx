import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { PRESSED_OPACITY } from './BaseButton';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type TabBarButtonProps = {
  icon: IconName;
  /** Already translated. */
  label: string;
  /** Today (D-52): a filled green pill holding a larger white icon and label, selected or not. */
  emphasized?: boolean;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID: string;
};

/**
 * One tab of FloatingTabBar: icon in a pill (tinted when selected) over a caption. The emphasized tab is
 * one green pill around both; when selected it gains a dark ring and a heavier label.
 */
export function TabBarButton({
  icon,
  label,
  emphasized = false,
  focused,
  onPress,
  onLongPress,
  testID,
}: TabBarButtonProps) {
  const [pressed, setPressed] = useState(false);
  const tint = emphasized ? 'surface' : focused ? 'brandText' : 'muted';
  const caption = (
    <Text
      maxFontSizeMultiplier={maxTextScale.tabLabel}
      style={[
        textStyle('caption', emphasized && focused ? '800' : focused ? '700' : '600'),
        { color: colors[tint] },
        styles.label,
      ]}
    >
      {label}
    </Text>
  );
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
      {emphasized ? (
        <View
          style={[styles.emphasis, focused ? styles.emphasisFocused : null]}
          testID={focused ? 'tab-active-pill' : 'tab-emphasis-pill'}
        >
          <Icon name={icon} color={tint} size={sizes.tabIconEmphasized} strokeWidth={focused ? 2.4 : 2} />
          {caption}
        </View>
      ) : (
        <>
          <View
            style={[styles.pill, focused ? styles.pillActive : null]}
            testID={focused ? 'tab-active-pill' : undefined}
          >
            <Icon name={icon} color={tint} size={sizes.tabIcon} strokeWidth={focused ? 2 : 1.8} />
          </View>
          {caption}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    // A whole column of the bar is the target: 68 tall, the bar's width divided by the tabs.
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
  emphasis: {
    minWidth: sizes.tabEmphasisMinWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes.tabIconLabelGap,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    // Always there, so selecting doesn't change the pill's size; the color shows the ring.
    borderWidth: sizes.tabEmphasisRing,
    borderColor: colors.brand,
  },
  emphasisFocused: { borderColor: colors.brandText },
  label: { textAlign: 'center' },
});
