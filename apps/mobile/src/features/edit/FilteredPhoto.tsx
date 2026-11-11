import { Canvas, ColorMatrix, Image, type SkImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import type { ColorMatrix as Matrix } from './filters';

export type FilteredPhotoProps = {
  /** Decoded once by the screen and shared by the main canvas and every thumbnail. */
  image: SkImage | null;
  matrix: Matrix;
  width: number;
  height: number;
  testID?: string;
};

/** The photo drawn by Skia with a color matrix applied, filling `width × height` (cover). */
export function FilteredPhoto({ image, matrix, width, height, testID }: FilteredPhotoProps) {
  return (
    <Canvas style={[styles.canvas, { width, height }]} testID={testID} pointerEvents="none">
      {image ? (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover">
          <ColorMatrix matrix={[...matrix]} />
        </Image>
      ) : null}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { overflow: 'hidden' },
});
