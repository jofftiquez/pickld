import * as Location from 'expo-location';

import { lookUpCurrentPlace, placeName } from '../place/currentPlace';

jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));
const mocked = jest.mocked(Location);

const address = {
  name: '12 Session Road',
  street: 'Session Road',
  streetNumber: '12',
  district: 'Kabayanihan',
  postalCode: '2600',
  city: 'Baguio',
  subregion: 'Benguet',
  region: 'Cordillera',
  country: 'Philippines',
};

describe('the place read from the phone', () => {
  it('is the town only: never the street, number, district or postcode', () => {
    expect(placeName(address)).toBe('Baguio');
  });

  it('falls back to the widest named area when there is no town', () => {
    expect(placeName({ ...address, city: null })).toBe('Benguet');
    expect(placeName({ city: ' ', subregion: null, region: null, country: 'Japan' })).toBe('Japan');
    expect(placeName({ city: null, subregion: null, region: null, country: null })).toBeNull();
  });

  it('asks while in use, at the lowest accuracy, and returns only the name', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mocked.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 16.41, longitude: 120.59 } } as never);
    mocked.reverseGeocodeAsync.mockResolvedValue([address] as never);
    await expect(lookUpCurrentPlace()).resolves.toEqual({ kind: 'found', text: 'Baguio' });
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Lowest });
  });

  it('reads no location when permission is refused, and fails quietly when the lookup does', async () => {
    mocked.getCurrentPositionAsync.mockClear();
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await expect(lookUpCurrentPlace()).resolves.toEqual({ kind: 'denied' });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();

    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
    await expect(lookUpCurrentPlace()).resolves.toEqual({ kind: 'failed' });
  });
});
