import { useId } from 'react';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Rect } from 'react-native-svg';

import { BODY, HIGHLIGHT, LAYER, layerY, LID, MAX_LAYERS, NECK, STROKE_WIDTH, VIEW_H, VIEW_W } from './JarGraphic';
import { colors, splash } from '@/theme/tokens';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// The shine as a filled rounded rect with the round-capped line's exact outline: a translucent stroke's caps
// can render as darker dots in some SVG renderers (the launch image's), a single filled shape renders the same.
export const SPLASH_HIGHLIGHT = {
  x: HIGHLIGHT.x - HIGHLIGHT.width / 2,
  y: HIGHLIGHT.top - HIGHLIGHT.width / 2,
  width: HIGHLIGHT.width,
  height: HIGHLIGHT.bottom - HIGHLIGHT.top + HIGHLIGHT.width,
  rx: HIGHLIGHT.width / 2,
};

// Each layer drops in from this far above its resting place (viewBox units) as it fades in.
export const SPLASH_LAYER_DROP = 12;

type LayerProps = { index: number; level: SharedValue<number> };

function Layer({ index, level }: LayerProps) {
  const restY = layerY(index);
  const props = useAnimatedProps(() => {
    // 0 before this layer starts, 1 once it has landed.
    const shown = Math.min(1, Math.max(0, level.value - index));
    return { y: restY - SPLASH_LAYER_DROP * (1 - shown), opacity: shown };
  });
  return (
    <AnimatedRect
      testID="splash-jar-layer"
      x={LAYER.x}
      width={LAYER.width}
      height={LAYER.height}
      fill={index % 2 === 0 ? splash.layer : splash.layerAlt}
      animatedProps={props}
    />
  );
}

type Props = {
  /** Layers shown, 0–8; fractions are a layer on its way in. At 0 it matches the native launch image. */
  level: SharedValue<number>;
};

/**
 * The launch screen's jar (D-147): the app's jar shape in white on brand green. The empty jar is drawn the
 * same way in assets/brand/splash-jar.svg, which becomes the native launch image.
 */
export function SplashJar({ level }: Props) {
  const clipId = `splash-jar-${useId().replace(/:/g, '')}`;
  const white = colors.surface;
  return (
    <Svg
      width={splash.jarWidth}
      height={(splash.jarWidth * VIEW_H) / VIEW_W}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      testID="splash-jar"
    >
      <Defs>
        <ClipPath id={clipId}>
          <Rect {...BODY} />
        </ClipPath>
      </Defs>
      <Rect {...BODY} fill={white} fillOpacity={splash.glassOpacity} />
      <G clipPath={`url(#${clipId})`}>
        {Array.from({ length: MAX_LAYERS }, (_, i) => (
          <Layer key={i} index={i} level={level} />
        ))}
      </G>
      <Rect {...BODY} fill="none" stroke={white} strokeWidth={STROKE_WIDTH} />
      <Rect {...NECK} fill="none" stroke={white} strokeWidth={STROKE_WIDTH} />
      <Rect {...LID} fill={white} />
      <Rect {...SPLASH_HIGHLIGHT} fill={white} fillOpacity={splash.highlightOpacity} />
    </Svg>
  );
}
