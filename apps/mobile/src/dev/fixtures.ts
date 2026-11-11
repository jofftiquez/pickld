// Dev-only placeholder photos (downscaled copies of design/images, COCO placeholders) for the gallery.
import { Image } from 'react-native';

const uriOf = (m: number): string => Image.resolveAssetSource(m)?.uri ?? '';

export const devPhotos = {
  morning: uriOf(require('../../assets/dev/morning.jpg')),
  ootd: uriOf(require('../../assets/dev/ootd.jpg')),
  selfie: uriOf(require('../../assets/dev/selfie.jpg')),
  whereami: uriOf(require('../../assets/dev/whereami.jpg')),
  dale: uriOf(require('../../assets/dev/av_dale.jpg')),
};
