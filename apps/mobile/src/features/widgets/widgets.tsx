// The two home screen widgets (M6-10; FR-WID-01, design: Widgets): Today (medium) with the jar, its count, what's
// next and a capture button, and Friend (small) with the latest moment from someone the user reads.
// Each 'widget' function is turned into source text and runs in the widget extension on its own: it can use
// only its props and the @expo/ui SwiftUI components and modifiers (globals there, so keep their names), never
// anything else from this file. Colours therefore come in through props, from tokens.ts.
// Each layout's root sets containerBackground for the widget (iOS 17+ shows "Please adopt containerBackground API"
// instead of a widget without one) and keeps background for iOS 16.
import {
  Circle,
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
  accessibilityLabel,
  background,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import i18n from '@/i18n';
import { colors } from '@/theme/tokens';

import type { FriendWidgetProps, TodayWidgetProps } from './widgetPayload';

export type WidgetColors = {
  brand: string;
  brandLayer: string;
  brandText: string;
  ink: string;
  muted: string;
  surface: string;
  glass: string;
  placeholder: string;
};

export type TodayProps = TodayWidgetProps & { colors: WidgetColors };
export type FriendProps = FriendWidgetProps & { placeholder: string; colors: WidgetColors };

function TodayLayout(props: TodayProps) {
  'widget';
  const c = props.colors;
  // The jar as in the design: a green lid on an outlined neck, and an outlined body filled from the bottom.
  const body = { width: 50, height: 52 };
  const fill = Math.max(props.fill > 0 ? 6 : 0, body.height * props.fill);
  return (
    <HStack
      spacing={14}
      modifiers={[background(c.surface), containerBackground(c.surface, 'widget'), widgetURL(props.url)]}
    >
      <VStack spacing={0} modifiers={[accessibilityLabel(props.headline)]}>
        <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(c.brand), frame({ width: 38, height: 9 })]} />
        <RoundedRectangle
          cornerRadius={2}
          modifiers={[
            foregroundStyle(c.surface),
            strokeBorder({ content: c.ink, style: { lineWidth: 3 }, shape: 'roundedRectangle', cornerRadius: 2 }),
            frame({ width: 32, height: 7 }),
          ]}
        />
        <ZStack
          alignment="bottom"
          modifiers={[frame({ width: body.width, height: body.height }), clipShape('roundedRectangle', 14)]}
        >
          <Rectangle modifiers={[foregroundStyle(c.surface)]} />
          <VStack spacing={0} modifiers={[frame({ width: body.width, height: fill })]}>
            <Rectangle modifiers={[foregroundStyle(c.brandLayer)]} />
            <Rectangle modifiers={[foregroundStyle(c.brand)]} />
          </VStack>
          <RoundedRectangle
            cornerRadius={14}
            modifiers={[
              foregroundStyle('clear'),
              strokeBorder({ content: c.ink, style: { lineWidth: 3 }, shape: 'roundedRectangle', cornerRadius: 14 }),
            ]}
          />
        </ZStack>
      </VStack>
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
