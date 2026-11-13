import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { colors, jar, lidColors, motion, sizes, slots } from '@/theme/tokens';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Geometry from the design's 48×60 jar (Main, JarLid, FullJar).
const VIEW_W = 48;
const VIEW_H = 60;
const BODY = { x: 5, y: 15, width: 38, height: 42, rx: 10 };
const LAYER = { x: 6, width: 36, height: 5.3, bottomY: 51, step: 5 };
// The newest layer drops from this far above its resting place.
const SETTLE_DROP = 24;
// Publishing (D-77): the lid starts this far above the jar and drops shut.
const LID = { x: 10, y: 2, width: 28, height: 8, rx: 3 };
const LID_LIFT = 10;

export const MAX_LAYERS = slots.length;

/** Resting y of layer `i` (0 is the bottom), in viewBox units. */
export function layerY(i: number): number {
  return LAYER.bottomY - LAYER.step * i;
}

export type JarGraphicProps = {
  /** Moments in the jar, 0–8; values outside are clamped. */
  count: number;
  lidColor?: string;
  /** Width in px; height follows the jar's 4:5 shape. Designs use 14, 22 and 52. */
  size?: number;
  /** Lighter glass and outline for dark cards (FullJar). */
  onDark?: boolean;
  /** Hide from screen readers when the count is already read next to it. */
  decorative?: boolean;
  /** The day was just published (D-58): the lid drops shut, or fades in with Reduce Motion. Plays when it turns true. */
  closeLid?: boolean;
  testID?: string;
};

/** Glass jar with a colored lid, filled with one layer per moment. */
export function JarGraphic({
  count,
  lidColor = lidColors.pickle,
  size = sizes.jarCardGraphic,
  onDark = false,
  decorative = false,
  closeLid = false,
  testID,
}: JarGraphicProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const layers = Math.max(0, Math.min(MAX_LAYERS, Math.round(count)));
  const clipId = `jar-${useId().replace(/:/g, '')}`;

  // 1 means the newest layer is at rest. Only a count that grows after mount animates.
  const settle = useSharedValue(1);
  const previous = useRef(layers);
  useEffect(() => {
    if (layers > previous.current) {
      settle.value = 0;
      settle.value = reduceMotion
        ? withTiming(1, { duration: motion.base })
        : withTiming(1, { duration: motion.jarLayerSettle, easing: Easing.out(Easing.cubic) });
    }
    previous.current = layers;
  }, [layers, reduceMotion, settle]);

  const newestY = layerY(layers - 1);
  const newestProps = useAnimatedProps(() => ({
    y: reduceMotion ? newestY : newestY - SETTLE_DROP * (1 - settle.value),
    opacity: reduceMotion ? settle.value : 1,
  }));

  // 1 means the lid is shut. It plays when closeLid turns true, including a graphic that mounts with it.
  const lid = useSharedValue(closeLid ? 0 : 1);
  useEffect(() => {
    if (!closeLid) return;
    lid.value = 0;
    lid.value = reduceMotion
      ? withTiming(1, { duration: motion.base })
      : withTiming(1, { duration: motion.celebrationPop, easing: Easing.out(Easing.cubic) });
  }, [closeLid, lid, reduceMotion]);
  const lidProps = useAnimatedProps(() => ({
    y: reduceMotion ? LID.y : LID.y - LID_LIFT * (1 - lid.value),
    opacity: reduceMotion ? lid.value : 1,
  }));

  const stroke = onDark ? jar.strokeOnDark : colors.ink;
  const layerColor = (i: number) => (i % 2 === 0 ? colors.brand : colors.brandLayer);

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : t('jar.moments', { count: layers, total: MAX_LAYERS })}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={decorative}
      style={{ width: size, height: (size * VIEW_H) / VIEW_W, flexShrink: 0 }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect {...BODY} />
          </ClipPath>
        </Defs>
        <Rect {...BODY} fill={onDark ? jar.glassOnDark : jar.glass} />
        <G clipPath={`url(#${clipId})`}>
          {Array.from({ length: Math.max(0, layers - 1) }, (_, i) => (
            <Rect
              key={i}
              testID="jar-layer"
              x={LAYER.x}
              y={layerY(i)}
              width={LAYER.width}
              height={LAYER.height}
              fill={layerColor(i)}
            />
          ))}
          {layers > 0 ? (
            <AnimatedRect
              testID="jar-layer"
              x={LAYER.x}
              width={LAYER.width}
              height={LAYER.height}
              fill={layerColor(layers - 1)}
              animatedProps={newestProps}
            />
          ) : null}
        </G>
        <Rect {...BODY} fill="none" stroke={stroke} strokeWidth={2} />
        <Rect x={13} y={10} width={22} height={5} rx={1.5} fill="none" stroke={stroke} strokeWidth={2} />
        <AnimatedRect
          testID="jar-lid"
          x={LID.x}
          width={LID.width}
          height={LID.height}
          rx={LID.rx}
          fill={lidColor}
          animatedProps={lidProps}
        />
        <Path d="M11 24v18" stroke={jar.highlight} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
