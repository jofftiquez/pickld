import * as Location from 'expo-location';

import { PLACE_TEXT_MAX } from '../edits';

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

/**
 * The town the phone is in, only when the user taps "Use where I am". Asks for location while using the
 * app, reads an approximate fix (iOS gives a reduced-accuracy one by default, app.config.ts) and turns it
 * into a town name with the system geocoder (Apple's on iOS, the platform's on Android; free). The
 * coordinates stay in this function: only the name comes back, and only the name is ever saved.
 */
export async function lookUpCurrentPlace(): Promise<PlaceLookup> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    const [address] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
    const text = address ? placeName(address) : null;
    return text ? { kind: 'found', text } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}
