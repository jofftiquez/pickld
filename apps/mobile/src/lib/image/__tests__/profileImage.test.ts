import { centerCrop } from '../profileImage';

jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-file-system', () => ({}));

describe('centerCrop', () => {
  it('takes the middle square of a portrait photo for an avatar', () => {
    expect(centerCrop(3000, 4000, 1)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
  });

  it('takes a full-width 5:2 band from the middle of a portrait photo for a cover', () => {
    expect(centerCrop(3000, 4000, 2.5)).toEqual({ originX: 0, originY: 1400, width: 3000, height: 1200 });
  });

  it('trims the sides of a very wide photo', () => {
    expect(centerCrop(6000, 1000, 2.5)).toEqual({ originX: 1750, originY: 0, width: 2500, height: 1000 });
  });
});
