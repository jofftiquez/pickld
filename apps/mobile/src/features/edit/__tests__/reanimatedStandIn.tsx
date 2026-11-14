import { createElement, useState, type ComponentType } from 'react';
import { ScrollView, View } from 'react-native';

// Minimal Reanimated stand-in for the editor's tests (use with jest.mock): shared values are plain boxes
// and animated styles are computed on render, so the committed placement can be read off the views.
// Gesture-handler only needs its Reanimated hooks to exist; the overlay gestures all run on the JS thread.

type Box<T> = { value: T; get: () => T; set: (value: T) => void };

// Animated components take their animated props as plain props, so a drawing's committed values can be read.
function createAnimatedComponent<P extends object>(component: ComponentType<P>) {
  return function AnimatedComponent({ animatedProps, ...rest }: P & { animatedProps?: object }) {
    return createElement(component, { ...rest, ...animatedProps } as P);
  };
}

export default { View, ScrollView, createAnimatedComponent };

export function useSharedValue<T>(initial: T): Box<T> {
  const [box] = useState(() => {
    const created: Box<T> = {
      value: initial,
      get: () => created.value,
      set: (value) => {
        created.value = value;
      },
    };
    return created;
  });
  return box;
}

export const useAnimatedStyle = (style: () => object) => style();
export const useAnimatedScrollHandler = () => () => undefined;
export const useHandler = () => ({ doDependenciesDiffer: false, context: {} });
export const useEvent = () => () => undefined;
export const useComposedEventHandler = () => () => undefined;
export const isSharedValue = () => false;

// Enough for the screens' small animations (JarGraphic, pops, the publish burst; D-58): animations land at
// once and Reduce Motion is off. jest.setup.ts uses this stand-in for every test file without its own mock.
export const useReducedMotion = () => false;
export const useAnimatedProps = (props: () => object) => props();
export const withTiming = <T,>(to: T) => to;
export const withSpring = <T,>(to: T) => to;
export const withDelay = <T,>(_ms: number, value: T) => value;
export const withSequence = <T,>(...values: T[]) => values[values.length - 1];
export const cancelAnimation = () => undefined;
export const Easing = {
  out: (easing: unknown) => easing,
  inOut: (easing: unknown) => easing,
  cubic: 'cubic',
  quad: 'quad',
  linear: 'linear',
};
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' };
