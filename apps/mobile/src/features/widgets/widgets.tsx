// The two home screen widgets (M6-10; FR-WID-01, design: Widgets): Today (medium) with the jar, its count, what's
// next and a capture button, and Friend (small) with the latest moment from someone the user reads. Today also
// comes small (for StandBy) and in the three Lock Screen sizes; Friend shows in StandBy as it is.
// Each 'widget' function is turned into source text and runs in the widget extension on its own: it can use
// only its props and the @expo/ui SwiftUI components and modifiers (globals there, so keep their names), never
// anything else from this file. Colours therefore come in through props, from tokens.ts.
// Each layout's root sets containerBackground for the widget (iOS 17+ shows "Please adopt containerBackground API"
// instead of a widget without one) and keeps background for iOS 16.
import {
  Circle,
  Gauge,
  HStack,
  Image,
  Link,
  Rectangle,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityLabel,
  background,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import i18n from '@/i18n';
import { colors } from '@/theme/tokens';

import type { FriendWidgetProps, TodayWidgetProps } from './widgetPayload';

export type WidgetColors = {
  brand: string;
  brandLayer: string;
  brandText: string;
  ink: string;
  muted: string;
  onDark: string;
  onDarkMuted: string;
  surface: string;
  glass: string;
  placeholder: string;
};

export type TodayProps = TodayWidgetProps & { colors: WidgetColors };
export type FriendProps = FriendWidgetProps & { placeholder: string; colors: WidgetColors };
/** expo-widgets also passes WidgetKit's showsWidgetContainerBackground, which its type leaves out. */
type TodayEnvironment = WidgetEnvironment & { showsContainerBackground?: boolean };

function TodayLayout(props: TodayProps, env: TodayEnvironment) {
  'widget';
  const c = props.colors;
  const family = env.widgetFamily;

  // Lock Screen (iOS 16+): the system tints these, so they use its default and secondary colours, not ours.
  if (family === 'accessoryInline') {
    return <Text modifiers={[containerBackground('clear', 'widget'), widgetURL(props.url)]}>{props.inline}</Text>;
  }
  if (family === 'accessoryCircular') {
    // The widget renderer drops Gauge's label slots, so the count sits on top of the ring instead.
    return (
      <ZStack
        modifiers={[
          accessibilityElement('ignore'),
          accessibilityLabel(props.headline),
          containerBackground('clear', 'widget'),
          widgetURL(props.url),
        ]}
      >
        <Gauge value={props.fill} modifiers={[gaugeStyle('circularCapacity')]} />
        <Text modifiers={[font({ size: 15, weight: 'bold' }), minimumScaleFactor(0.7)]}>{props.short}</Text>
      </ZStack>
    );
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          frame({ maxWidth: 10000, alignment: 'leading' }),
          containerBackground('clear', 'widget'),
          widgetURL(props.url),
        ]}
      >
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.8)]}>
          {props.headline}
        </Text>
        <Text
          modifiers={[
            font({ size: 15 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
            minimumScaleFactor(0.8),
          ]}
        >
          {props.subline}
        </Text>
      </VStack>
    );
  }

  // StandBy (and the iPad Lock Screen) draw the widget on black without its background, so outlines and text
  // turn light there.
  const onDark = env.showsContainerBackground === false;
  const stroke = onDark ? c.onDark : c.ink;
  const inside = onDark ? 'clear' : c.surface;
  // The jar as in the design: a green lid on an outlined neck, and an outlined body filled from the bottom.
  // `k` scales it: 1 on the medium widget, smaller on the small one.
  const jar = (k: number) => {
    const body = { width: 50 * k, height: 52 * k };
    const fill = Math.max(props.fill > 0 ? 6 * k : 0, body.height * props.fill);
    return (
      <VStack spacing={0} modifiers={[accessibilityLabel(props.headline)]}>
        <RoundedRectangle
          cornerRadius={3 * k}
          modifiers={[foregroundStyle(c.brand), frame({ width: 38 * k, height: 9 * k })]}
        />
        <RoundedRectangle
          cornerRadius={2 * k}
          modifiers={[
            foregroundStyle(inside),
            strokeBorder({
              content: stroke,
              style: { lineWidth: 3 * k },
              shape: 'roundedRectangle',
              cornerRadius: 2 * k,
            }),
            frame({ width: 32 * k, height: 7 * k }),
          ]}
        />
        <ZStack
          alignment="bottom"
          modifiers={[frame({ width: body.width, height: body.height }), clipShape('roundedRectangle', 14 * k)]}
        >
          <Rectangle modifiers={[foregroundStyle(inside)]} />
          <VStack spacing={0} modifiers={[frame({ width: body.width, height: fill })]}>
            <Rectangle modifiers={[foregroundStyle(c.brandLayer)]} />
            <Rectangle modifiers={[foregroundStyle(c.brand)]} />
          </VStack>
          <RoundedRectangle
            cornerRadius={14 * k}
            modifiers={[
              foregroundStyle('clear'),
              strokeBorder({
                content: stroke,
                style: { lineWidth: 3 * k },
                shape: 'roundedRectangle',
                cornerRadius: 14 * k,
              }),
            ]}
          />
        </ZStack>
      </VStack>
    );
  };

  if (family === 'systemSmall') {
    // StandBy shows small widgets two at a time; this one is also on offer as a small home screen widget.
    return (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[
          frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }),
          // The iOS 16 background would stay behind the light text in StandBy, so it's left out there.
          ...(onDark ? [] : [background(c.surface)]),
          containerBackground(c.surface, 'widget'),
          widgetURL(props.url),
        ]}
      >
        {jar(0.8)}
        <Spacer />
        <Text
          modifiers={[
            font({ size: 17, weight: 'heavy' }),
            foregroundStyle(stroke),
            lineLimit(1),
            minimumScaleFactor(0.7),
          ]}
        >
          {props.headline}
        </Text>
        <Text
          modifiers={[
            font({ size: 13 }),
            foregroundStyle(onDark ? c.onDarkMuted : c.muted),
            lineLimit(1),
            minimumScaleFactor(0.8),
          ]}
        >
          {props.subline}
        </Text>
      </VStack>
    );
  }

  return (
    <HStack
      spacing={14}
      modifiers={[background(c.surface), containerBackground(c.surface, 'widget'), widgetURL(props.url)]}
    >
      {jar(1)}
      <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(c.brandText)]}>{props.title}</Text>
        <Text
          modifiers={[
            font({ size: 18, weight: 'heavy' }),
            foregroundStyle(c.ink),
            lineLimit(1),
            minimumScaleFactor(0.8),
          ]}
        >
          {props.headline}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted), lineLimit(1)]}>{props.subline}</Text>
      </VStack>
      <Spacer />
      {/* Only one widgetURL applies to a whole widget, so the capture button is a Link of its own. */}
      <Link destination={props.captureUrl} modifiers={[accessibilityLabel(props.captureLabel)]}>
        <ZStack modifiers={[frame({ width: 52, height: 52 })]}>
          <Circle modifiers={[foregroundStyle(c.brand)]} />
          <Image systemName="camera" size={20} color={c.surface} />
        </ZStack>
      </Link>
    </HStack>
  );
}

function FriendLayout(props: FriendProps) {
  'widget';
  const c = props.colors;
  return (
    <ZStack
      alignment="bottomLeading"
      modifiers={[background(c.placeholder), containerBackground(c.placeholder, 'widget'), widgetURL(props.url)]}
    >
      {props.imageUri ? (
        <Image uiImage={props.imageUri} modifiers={[resizable(), frame({ maxWidth: 10000, maxHeight: 10000 })]} />
      ) : (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted), padding({ all: 12 })]}>
          {props.placeholder}
        </Text>
      )}
      {props.imageUri ? (
        <Text
          modifiers={[
            font({ size: 13, weight: 'bold' }),
            foregroundStyle(c.surface),
            lineLimit(1),
            padding({ horizontal: 8, vertical: 3 }),
            background(c.glass),
            clipShape('capsule'),
            padding({ all: 10 }),
          ]}
        >
          {props.caption}
        </Text>
      ) : null}
    </ZStack>
  );
}

export const widgetColors: WidgetColors = {
  brand: colors.brand,
  brandLayer: colors.brandLayer,
  brandText: colors.brandText,
  ink: colors.ink,
  muted: colors.muted,
  onDark: colors.surface,
  onDarkMuted: colors.onDarkMuted,
  surface: colors.surface,
  glass: colors.badge,
  placeholder: colors.photoPlaceholder,
};

// What each widget shows before the app first writes its data (a fresh install, the widget gallery):
// an empty jar, and the friend placeholder.
export const TodayWidget = createWidget<TodayProps>('TodayJar', TodayLayout, {
  title: i18n.t('widgets.title'),
  headline: i18n.t('widgets.moments', { count: 0, total: 8 }),
  subline: i18n.t('widgets.nextUp', { tag: '#whereami' }),
  short: i18n.t('widgets.short', { count: 0, total: 8 }),
  inline: i18n.t('widgets.inlineNext', { short: i18n.t('widgets.short', { count: 0, total: 8 }), tag: '#whereami' }),
  fill: 0,
  url: 'pickld://today',
  captureUrl: 'pickld://camera',
  captureLabel: i18n.t('widgets.capture'),
  colors: widgetColors,
});
export const FriendWidget = createWidget<FriendProps>('FriendMoment', FriendLayout, {
  caption: '',
  imageUri: '',
  url: 'pickld://jars',
  placeholder: i18n.t('widgets.friendEmpty'),
  colors: widgetColors,
});
