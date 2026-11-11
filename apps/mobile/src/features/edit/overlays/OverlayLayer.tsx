import { useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useRotationGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import type { Overlay } from '../edits';
import { hitTest, type Placed } from './hitTest';
import { OverlayItem, type LiveTransform, type OverlayAction } from './OverlayItem';
import { getOverlayRenderer, type OverlayRenderer } from './registry';
import {
  applyDelta,
  handleDelta,
  sameTransform,
  stepTransform,
  toPixels,
  type Point,
  type Transform,
} from './transform';

export type OverlayLayerProps = {
  /** Drawn in order: the last one is on top. Kinds with no registered renderer are skipped. */
  overlays: readonly Overlay[];
  selectedId: string | null;
  /** The photo's size on screen; the layer covers it exactly. */
  width: number;
  height: number;
  onSelect: (id: string | null) => void;
  /** A finished gesture or accessibility step: the new transform (already clamped). */
  onTransform: (id: string, transform: Transform) => void;
  onBringToFront: (id: string) => void;
  onDelete: (id: string) => void;
  /** True while a finger is moving an overlay, so the screen can stop scrolling. */
  onGestureActiveChange?: (active: boolean) => void;
};

type GestureKind = 'pan' | 'pinch' | 'rotation';

/** One gesture on one overlay, from the first finger to the last one lifting. */
type Session = {
  id: string;
  /** `handle`: one finger on the corner handle resizes and rotates; `move`: drag, pinch and twist. */
  mode: 'move' | 'handle';
  start: Transform;
  aspect: number;
  active: Set<GestureKind>;
  dx: number;
  dy: number;
  pinch: number;
  rotation: number;
  /** Where the finger went down and where it is now (handle mode). */
  from: Point;
  to: Point;
};

type Item = { overlay: Overlay; renderer: OverlayRenderer; aspect: number };

/**
 * The overlays over the 3:4 photo (FR-CAP-05, FR-CAP-08). Tap selects (or deletes, on the selected
 * overlay's delete circle); drag moves; pinch resizes; two-finger twist rotates; the corner handle
 * resizes and rotates with one finger. The overlay follows the fingers live and the change is reported
 * once, when the last finger lifts, so each gesture is one Undo step. Nothing animates on its own, so
 * Reduce Motion has nothing to turn off.
 */
export function OverlayLayer({
  overlays,
  selectedId,
  width,
  height,
  onSelect,
  onTransform,
  onBringToFront,
  onDelete,
  onGestureActiveChange,
}: OverlayLayerProps) {
  const photo = { width, height };
  const items = overlays.flatMap((overlay): Item[] => {
    const renderer = getOverlayRenderer(overlay.type);
    return renderer ? [{ overlay, renderer, aspect: renderer.aspect(overlay) }] : [];
  });
  const placed: Placed[] = items.map(({ overlay, aspect }) => ({
    id: overlay.id,
    box: toPixels(overlay, photo, aspect),
  }));

  const live = useSharedValue<LiveTransform | null>(null);
  const session = useRef<Session | null>(null);
  const panStart = useRef<Point>({ x: 0, y: 0 });

  // The committed edits now show the gesture's result (or Undo changed them): stop drawing the live copy.
  useLayoutEffect(() => {
    if (session.current === null) live.set(null);
  }, [overlays, live]);

  const current = (s: Session): Transform => {
    if (s.mode === 'move')
      return applyDelta(s.start, { dx: s.dx, dy: s.dy, scale: s.pinch, rotation: s.rotation }, photo);
    const box = toPixels(s.start, photo, s.aspect);
    return applyDelta(s.start, handleDelta({ x: box.cx, y: box.cy }, s.from, s.to), photo);
  };

  const start = (kind: GestureKind, at: Point | null) => {
    let s = session.current;
    if (s === null) {
      if (at === null) return null;
      // A two-finger gesture works on the selected overlay wherever the fingers are; otherwise on what
      // the touch lands on.
      const hit = hitTest(placed, selectedId, at);
      const id = hit && hit.part !== 'delete' ? hit.id : kind !== 'pan' ? selectedId : null;
      const item = items.find((i) => i.overlay.id === id);
      if (!item) return null;
      const { x, y, scale, rotation } = item.overlay;
      s = {
        id: item.overlay.id,
        mode: kind === 'pan' && hit?.part === 'handle' ? 'handle' : 'move',
        start: { x, y, scale, rotation },
        aspect: item.aspect,
        active: new Set(),
        dx: 0,
        dy: 0,
        pinch: 1,
        rotation: 0,
        from: at,
        to: at,
      };
      session.current = s;
      onSelect(s.id);
      onGestureActiveChange?.(true);
    }
    s.active.add(kind);
    return s;
  };

  const update = (s: Session | null) => {
    if (s === null) return;
    live.set({ id: s.id, ...current(s) });
  };

  const finish = (kind: GestureKind) => {
    const s = session.current;
    if (s === null || !s.active.delete(kind) || s.active.size > 0) return;
    session.current = null;
    onGestureActiveChange?.(false);
    const next = current(s);
    if (sameTransform(next, s.start)) live.set(null);
    else onTransform(s.id, next);
  };

  // With nothing on the photo the layer stays out of the way, so a drag there scrolls the screen.
  const enabled = items.length > 0;

  const pan = usePanGesture({
    runOnJS: true,
    enabled,
    averageTouches: true,
    maxPointers: 2,
    testID: 'overlay-pan',
    onBegin: (e) => {
      panStart.current = { x: e.x, y: e.y };
    },
    onActivate: () => {
      start('pan', panStart.current);
    },
    onUpdate: (e) => {
      const s = session.current;
      if (s === null || !s.active.has('pan')) return;
      if (s.mode === 'handle')
        s.to = { x: panStart.current.x + e.translationX, y: panStart.current.y + e.translationY };
      else {
        s.dx = e.translationX;
        s.dy = e.translationY;
      }
      update(s);
    },
    onFinalize: () => finish('pan'),
  });

  const pinch = usePinchGesture({
    runOnJS: true,
    enabled,
    testID: 'overlay-pinch',
    onActivate: (e) => {
      start('pinch', { x: e.focalX, y: e.focalY });
    },
    onUpdate: (e) => {
      const s = session.current;
      if (s === null || !s.active.has('pinch')) return;
      s.pinch = e.scale;
      update(s);
    },
    onFinalize: () => finish('pinch'),
  });

  const rotate = useRotationGesture({
    runOnJS: true,
    enabled,
    testID: 'overlay-rotation',
    onActivate: (e) => {
      start('rotation', { x: e.anchorX, y: e.anchorY });
    },
    onUpdate: (e) => {
      const s = session.current;
      if (s === null || !s.active.has('rotation')) return;
      s.rotation = e.rotation;
      update(s);
    },
    onFinalize: () => finish('rotation'),
  });

  const tap = useTapGesture({
    runOnJS: true,
    enabled,
    testID: 'overlay-tap',
    onActivate: (e) => {
      const hit = hitTest(placed, selectedId, { x: e.x, y: e.y });
      if (hit?.part === 'delete') onDelete(hit.id);
      else onSelect(hit?.id ?? null);
    },
  });

  const gesture = useSimultaneousGestures(tap, pan, pinch, rotate);

  const act = (item: Item, action: OverlayAction) => {
    const { id } = item.overlay;
    if (action === 'select') onSelect(id);
    else if (action === 'delete') onDelete(id);
    else if (action === 'bringToFront') onBringToFront(id);
    else {
      onSelect(id);
      onTransform(id, stepTransform(item.overlay, action));
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.layer, { width, height }]} testID="overlay-layer">
        {items.map((item) => (
          <OverlayItem
            key={item.overlay.id}
            overlay={item.overlay}
            renderer={item.renderer}
            photo={photo}
            selected={item.overlay.id === selectedId}
            live={live}
            onAction={(action) => act(item, action)}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
});
