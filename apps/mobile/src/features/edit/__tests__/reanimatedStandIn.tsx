import { useState } from 'react';
import { View } from 'react-native';

// Minimal Reanimated stand-in for the editor's tests (use with jest.mock): shared values are plain boxes
// and animated styles are computed on render, so the committed placement can be read off the views.
// Gesture-handler only needs its Reanimated hooks to exist; the overlay gestures all run on the JS thread.

type Box<T> = { value: T; get: () => T; set: (value: T) => void };

export default { View, createAnimatedComponent: <T,>(component: T) => component };

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
export const useHandler = () => ({ doDependenciesDiffer: false, context: {} });
export const useEvent = () => () => undefined;
export const useComposedEventHandler = () => () => undefined;
export const isSharedValue = () => false;
