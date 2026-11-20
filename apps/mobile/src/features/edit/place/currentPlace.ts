import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { PLACE_TEXT_MAX } from '../edits';
import type { Coords } from './photoPlace';

export type PlaceLookup = { kind: 'found'; text: string } | { kind: 'denied' } | { kind: 'failed' };

/** The town a geocoded address is in, or the widest area it names when it has no town. */
export function placeName(
  address: Pick<Location.LocationGeocodedAddress, 'city' | 'subregion' | 'region' | 'country'>,
) {
  const name = [address.city, address.subregion, address.region, address.country]
    .map((part) => part?.trim() ?? '')
    .find((part) => part !== '');
  return name ? Array.from(name).slice(0, PLACE_TEXT_MAX).join('') : null;
}

/** The town at `coords`, from the system geocoder (Apple's on iOS, the platform's on Android; free). */
async function townAt(coords: Coords): Promise<PlaceLookup> {
  const [address] = await Location.reverseGeocodeAsync(coords);
  const text = address ? placeName(address) : null;
  return text ? { kind: 'found', text } : { kind: 'failed' };
}

/**
 * The town the phone is in, only when the user taps "Use where I am". Asks for location while using the
 * app, reads an approximate fix (iOS gives a reduced-accuracy one by default, app.config.ts) and turns it
 * into a town name. The coordinates stay in this function: only the name comes back, and only the name is
 * ever saved.
 */
export async function lookUpCurrentPlace(): Promise<PlaceLookup> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    return await townAt({ latitude: coords.latitude, longitude: coords.longitude });
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * The town a photo was taken in, from its own coordinates (photoPlace.ts), only when the user taps "Use the
 * photo's location". iOS geocodes without asking; Android's geocoder needs location permission first.
 */
export async function lookUpPhotoPlace(coords: Coords): Promise<PlaceLookup> {
  try {
    if (Platform.OS === 'android' && !(await Location.requestForegroundPermissionsAsync()).granted) {
      return { kind: 'denied' };
    }
    return await townAt(coords);
  } catch {
    return { kind: 'failed' };
  }
}
