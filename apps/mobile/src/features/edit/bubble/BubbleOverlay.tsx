import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fontFamilies } from '@/theme/fontFamilies';
import { bubble, bubbleColors } from '@/theme/tokens';

import type { BubbleShape, BubbleTail } from '../edits';
import { registerOverlayRenderer, type OverlayContentProps } from '../overlays/registry';
import {
  bubbleAspect,
  bubbleLines,
  bubbleTailGeometry,
  bubbleTailSide,
  cloudGeometry,
  isCloud,
  paddingXFor,
  tailPathData,
} from './bubbleLayout';

function shapeStyle(shape: BubbleShape, tail: BubbleTail, k: number, height: number): ViewStyle {
  switch (shape) {
    case 'speech':
      return tail === 'left'
        ? { borderRadius: bubble.radius * k, borderBottomLeftRadius: bubble.tailRadius * k }
        : { borderRadius: bubble.radius * k, borderBottomRightRadius: bubble.tailRadius * k };
    case 'thought':
      return { borderRadius: height / 2 };
    case 'shout':
      return { borderRadius: bubble.shoutRadius * k };
    case 'whisper':
      return { borderRadius: bubble.whisperRadius * k, borderStyle: 'dashed', borderWidth: bubble.whisperBorder * k };
  }
}

/**
 * The tail below the bubble's box, on its side (bubbleTailGeometry): drawn over the body's bottom edge in
 * the fill color, so it reads as one shape. Whisper's point carries the dashed outline down its two edges.
 */
function BubbleTailArt({
  shape,
  tail,
  cloud,
  k,
  height,
  fill,
  line,
  testID,
}: {
  shape: BubbleShape;
  tail: BubbleTail;
  cloud: boolean;
  k: number;
  height: number;
  fill: string;
  line: string;
  testID: string;
}) {
  const h = height / k;
  const geometry = bubbleTailGeometry(shape, tail, h, cloud);
  const bw = bubble.whisperBorder;
  return (
    <Svg
      width={bubble.referenceWidth * k}
      height={(h + geometry.extent) * k}
      viewBox={`0 0 ${bubble.referenceWidth} ${h + geometry.extent}`}
      style={styles.tail}
      pointerEvents="none"
      testID={testID}
    >
      {geometry.kind === 'dots' ? (
        geometry.dots.map((d, i) => <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={fill} />)
      ) : (
        <>
          <Path d={tailPathData(geometry.points)} fill={fill} />
          {shape === 'whisper' ? (
            <Path
              d={`M${geometry.points.map(([x, y]) => `${x} ${y}`).join(' L')}`}
              fill="none"
              stroke={line}
              strokeWidth={bw}
              strokeDasharray={`${bw * 3} ${bw * 2}`}
            />
          ) : null}
        </>
      )}
    </Svg>
  );
}

/** A cloud thought's body (cloudGeometry): its middle and the puffs round it, in one fill. */
function CloudArt({ k, height, fill, testID }: { k: number; height: number; fill: string; testID: string }) {
  const h = height / k;
  const { core, puffs } = cloudGeometry(h);
  return (
    <Svg
      width={bubble.referenceWidth * k}
      height={height}
      viewBox={`0 0 ${bubble.referenceWidth} ${h}`}
      style={styles.tail}
      pointerEvents="none"
      testID={testID}
    >
      <Rect x={core.x} y={core.y} width={core.width} height={core.height} fill={fill} />
      {puffs.map((p, i) => (
        <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={fill} />
      ))}
    </Svg>
  );
}

/**
 * A speech bubble (design: Bubble): the shape filled with its color and the user's text, laid out at the
 * reference width and scaled to fill the overlay's box, with its tail hanging below the box on its side.
 * The tail sits outside the box, so a bubble's size and place are the same as before tails existed.
 */
export function BubbleOverlay({ overlay, width, height }: OverlayContentProps<'bubble'>) {
  const { shape, color, text } = overlay;
  const tail = bubbleTailSide(overlay);
  const cloud = isCloud(overlay);
  const k = width / bubble.referenceWidth;
  const pair = bubbleColors[color];
  return (
    // The shadow and Shout's slant are on the whole bubble, so they take in the tail too.
    <View
      style={[styles.bubble, { width, height }, shape === 'shout' ? styles.shout : null]}
      testID={`bubble-${overlay.id}-shape`}
    >
      {cloud ? <CloudArt k={k} height={height} fill={pair.fill} testID={`bubble-${overlay.id}-cloud`} /> : null}
      <View
        style={[
          styles.body,
          {
            width,
            height,
            backgroundColor: cloud ? 'transparent' : pair.fill,
            borderColor: pair.text,
            paddingHorizontal: paddingXFor(shape) * k,
            paddingVertical: bubble.paddingY * k,
          },
          cloud ? null : shapeStyle(shape, tail, k, height),
        ]}
        testID={`bubble-${overlay.id}`}
      >
        {text === '' ? null : (
          <Text
            // a11y-fixed-size: part of the picture, same size on every screen, whatever the system text size.
            allowFontScaling={false}
            numberOfLines={bubbleLines(text, shape)}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[
              styles.text,
              {
                color: pair.text,
                fontFamily: shape === 'shout' ? fontFamilies.extrabold : fontFamilies.bold,
                fontSize: bubble.fontSize * k,
                lineHeight: bubble.lineHeight * k,
              },
            ]}
          >
            {text}
          </Text>
        )}
      </View>
      <BubbleTailArt
        shape={shape}
        tail={tail}
        cloud={cloud}
        k={k}
        height={height}
        fill={pair.fill}
        line={pair.text}
        testID={`bubble-${overlay.id}-tail-${tail}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { ...bubble.shadow },
  shout: { transform: [{ skewX: bubble.shoutSkew }] },
  body: { justifyContent: 'center' },
  tail: { position: 'absolute', left: 0, top: 0 },
  text: { textAlign: 'center' },
});

/** Draws `bubble` overlays with their shape, color and text (call once, before any placeholder). */
export function registerBubbleRenderer(): void {
  registerOverlayRenderer('bubble', {
    aspect: bubbleAspect,
    Content: BubbleOverlay,
    accessibilityLabel: (overlay, t) => {
      const shape = t(`editBubble.shape.${overlay.shape}`);
      return overlay.text === ''
        ? t('editBubble.labelEmpty', { shape })
        : t('editBubble.label', { shape, text: overlay.text });
    },
  });
}
