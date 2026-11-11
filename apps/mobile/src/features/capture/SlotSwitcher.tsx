import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
  type ScrollViewInstance,
} from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, sizes, slots, space, type Slot } from '@/theme/tokens';

export type SlotSwitcherProps = {
  selected: Slot;
  /** Slots that already have a moment in the open jar: shown, but not selectable. */
  taken: ReadonlySet<Slot>;
  onSelect: (slot: Slot) => void;
  /** Scroll to the selected tab without animating (Reduce Motion). */
  reduceMotion: boolean;
};

// Tab text is 13 px with 6 px vertical padding; hitSlop brings each tab to 44 px tall.
const TAB_HEIGHT = 30;

/** Moment tabs under the viewfinder (Camera): changes which slot the photo is added to. */
export function SlotSwitcher({ selected, taken, onSelect, reduceMotion }: SlotSwitcherProps) {
  const { t } = useTranslation();
  const scroll = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [layouts, setLayouts] = useState<Partial<Record<Slot, LayoutRectangle>>>({});
  const selectedLayout = layouts[selected];

  // Keep the selected tab centred, e.g. #evening opened from Today.
  useEffect(() => {
    if (!selectedLayout || width === 0) return;
    const x = Math.max(0, selectedLayout.x + selectedLayout.width / 2 - width / 2);
    scroll.current?.scrollTo({ x, animated: !reduceMotion });
  }, [selectedLayout, width, reduceMotion]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={t('camera.moment')}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      contentContainerStyle={styles.row}
      testID="camera-slot-switcher"
    >
      {slots.map((slot) => {
        const isSelected = slot === selected;
        const isTaken = taken.has(slot) && !isSelected;
        const tag = t(`slots.${slot}`);
        return (
          <Pressable
            key={slot}
            accessibilityRole="tab"
            accessibilityLabel={isTaken ? t('camera.slotAdded', { slot: tag }) : tag}
            accessibilityState={{ selected: isSelected, disabled: isTaken }}
            disabled={isTaken}
            onPress={() => onSelect(slot)}
            hitSlop={hitSlopFor(undefined, TAB_HEIGHT)}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout;
              setLayouts((prev) => ({ ...prev, [slot]: layout }));
            }}
            testID={`camera-slot-${slot}`}
            style={styles.tab}
          >
            <Text
              style={[
                textStyle('bodySmall', '700'),
                { color: isSelected ? colors.surface : colors.onDarkFaint },
                isTaken ? styles.taken : null,
              ]}
            >
              {tag}
            </Text>
            <View style={[styles.underline, isSelected ? styles.underlineOn : null]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.lg + 2, paddingHorizontal: space.xl, paddingTop: space.lg + 2, paddingBottom: space.xs + 2 },
  tab: { minHeight: TAB_HEIGHT, paddingTop: space.xs + 2, paddingHorizontal: 2, justifyContent: 'flex-end' },
  underline: { height: sizes.cameraTabUnderline, marginTop: space.xs + 2, borderRadius: sizes.cameraTabUnderline },
  underlineOn: { backgroundColor: colors.brand },
  taken: { textDecorationLine: 'line-through' },
});
