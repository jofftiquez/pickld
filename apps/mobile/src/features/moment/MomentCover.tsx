import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { coverBox } from './momentRender';
import { MomentView, type MomentViewProps } from './MomentView';

export type MomentCoverProps = Omit<MomentViewProps, 'width' | 'testID'> & { testID?: string };

/**
 * A moment filling its parent the way `contentFit="cover"` fills it with the plain photo: scaled to
 * cover, centred, the rest clipped by the parent. For frames that aren't 3:4, such as Today's tiles.
 */
export function MomentCover({ testID, ...view }: MomentCoverProps) {
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    setFrame({ width: layout.width, height: layout.height });
  const box = frame && frame.width > 0 && frame.height > 0 ? coverBox(frame) : null;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" testID={testID}>
      {box ? (
        <View style={[styles.place, { left: box.left, top: box.top }]}>
          <MomentView {...view} width={box.width} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  place: { position: 'absolute' },
});
