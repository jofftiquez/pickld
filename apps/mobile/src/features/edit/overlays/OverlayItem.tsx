import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { colors, radius, shadow, sizes } from '@/theme/tokens';

import type { Overlay } from '../edits';
import { useAspectRevision, type OverlayRenderer } from './registry';
import type { Size, Step, Transform } from './transform';

/** The overlay a gesture is moving right now, before the change is committed to the edits. */
export type LiveTransform = Transform & { id: string };

export type OverlayAction = Step | 'select' | 'bringToFront' | 'delete';

const steps: readonly Step[] = ['left', 'right', 'up', 'down', 'bigger', 'smaller', 'rotateLeft', 'rotateRight'];

export type OverlayItemProps = {
  overlay: Overlay;
  renderer: OverlayRenderer;
  photo: Size;
  selected: boolean;
  live: SharedValue<LiveTransform | null>;
  onAction: (action: OverlayAction) => void;
};

/**
 * One overlay on the photo: its content in a box placed by its transform (or by the live gesture), and
 * when selected the dashed outline, delete circle and corner handle (design: Stickers). Touches are
 * handled by the layer; screen readers get the same changes as accessibility actions.
 */
export function OverlayItem({ overlay, renderer, photo, selected, live, onAction }: OverlayItemProps) {
  const { t } = useTranslation();
  useAspectRevision();
  const aspect = renderer.aspect(overlay);
  const { id, x, y, scale, rotation } = overlay;
  // The content is laid out at the committed size; a live pinch scales it until the change is saved.
  const contentWidth = scale * photo.width;
  const contentHeight = contentWidth * aspect;

  const boxStyle = useAnimatedStyle(() => {
    const now = live.value;
    const tr = now !== null && now.id === id ? now : { x, y, scale, rotation };
    const width = tr.scale * photo.width;
    const height = width * aspect;
    return {
      width,
      height,
      transform: [
        { translateX: tr.x * photo.width - width / 2 },
        { translateY: tr.y * photo.height - height / 2 },
        { rotate: `${tr.rotation}rad` },
      ],
    };
  });
  const contentStyle = useAnimatedStyle(() => {
    const now = live.value;
    const k = now !== null && now.id === id && scale > 0 ? now.scale / scale : 1;
    return { transform: [{ scale: k }] };
  });

  const actions = [
    { name: 'activate' },
    ...steps.map((step) => ({ name: step, label: t(`editOverlay.action.${step}`) })),
    { name: 'bringToFront', label: t('editOverlay.action.bringToFront') },
    { name: 'delete', label: t('editOverlay.action.delete') },
  ];
  const onAccessibilityAction = ({ nativeEvent: { actionName } }: AccessibilityActionEvent) => {
    if (actionName === 'activate') onAction('select');
    else if (actionName === 'bringToFront' || actionName === 'delete') onAction(actionName);
    else {
      const step = steps.find((s) => s === actionName);
      if (step) onAction(step);
    }
  };

  const { Content } = renderer;
  return (
    <Animated.View
      style={[styles.box, boxStyle]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={renderer.accessibilityLabel(overlay, t)}
      accessibilityHint={t(selected ? 'editOverlay.hintSelected' : 'editOverlay.hint')}
      accessibilityState={{ selected }}
      accessibilityActions={actions}
      onAccessibilityAction={onAccessibilityAction}
      testID={`overlay-${id}`}
    >
      <Animated.View
        style={[
          styles.content,
          { width: contentWidth, height: contentHeight, marginLeft: -contentWidth / 2, marginTop: -contentHeight / 2 },
          contentStyle,
        ]}
      >
        <Content overlay={overlay} width={contentWidth} height={contentHeight} />
      </Animated.View>
      {selected ? (
        <View style={StyleSheet.absoluteFill} testID={`overlay-${id}-selected`}>
          <View style={styles.outline} />
          <View style={[styles.control, styles.delete]}>
            <Icon name="close" color="ink" size={sizes.overlayDeleteIcon} strokeWidth={2.6} />
          </View>
          <View style={[styles.control, styles.handle]} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0, top: 0 },
  content: { position: 'absolute', left: '50%', top: '50%' },
  outline: {
    position: 'absolute',
    top: -sizes.overlayOutlineInset,
    left: -sizes.overlayOutlineInset,
    right: -sizes.overlayOutlineInset,
    bottom: -sizes.overlayOutlineInset,
    borderWidth: sizes.overlayOutlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.overlayOutline,
    borderRadius: radius.overlayOutline,
  },
  control: {
    position: 'absolute',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.overlayControl,
  },
  delete: {
    top: -sizes.overlayDeleteOffset,
    right: -sizes.overlayDeleteOffset,
    width: sizes.overlayDelete,
    height: sizes.overlayDelete,
    borderRadius: sizes.overlayDelete / 2,
  },
  handle: {
    bottom: -sizes.overlayHandleOffset,
    right: -sizes.overlayHandleOffset,
    width: sizes.overlayHandle,
    height: sizes.overlayHandle,
    borderRadius: sizes.overlayHandle / 2,
  },
});
