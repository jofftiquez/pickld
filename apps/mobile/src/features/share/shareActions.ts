// The Share jar card's actions (FR-SOC-10, D-31). The card image is made on the phone from the card view
// (Skia's makeImageFromView), written as a PNG to the cache, and only goes where the user sends it.
import { makeImageFromView } from '@shopify/react-native-skia';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { Linking, Platform, Share, type View } from 'react-native';

import { settleStickerArt } from '@/features/edit/stickers/remoteStickerArt';

export type CardRef = RefObject<ComponentRef<typeof View> | null>;

// How long the card gets to draw sticker art that was still downloading when the user tapped.
const ART_SETTLE_MS = 400;

/**
 * Renders the card view to `<name>.png` in the cache; resolves with its file URI. Sticker art that isn't bundled
 * (D-131) is waited for first, so the image never shows a sticker's loading placeholder when the art exists.
 */
export async function renderCardImage(
  view: CardRef,
  name: string,
  stickerAssets: readonly string[] = [],
): Promise<string> {
  if (await settleStickerArt(stickerAssets)) await new Promise((resolve) => setTimeout(resolve, ART_SETTLE_MS));
  // Skia's type predates React Native's element refs; it reads the native view behind any host ref.
  const image = await makeImageFromView(view as unknown as Parameters<typeof makeImageFromView>[0]);
  if (!image) throw new Error('card render failed');
  const file = new File(Paths.cache, `${name}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(image.encodeToBytes());
  return file.uri;
}

export type SaveResult = 'saved' | 'denied';

/** Save image: add-only access to Photos (never reads the library). */
export async function saveImage(uri: string): Promise<SaveResult> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return 'denied';
  await Asset.create(uri);
  return 'saved';
}

export async function copyLink(url: string): Promise<void> {
  await Clipboard.setStringAsync(url);
}

/** Message: opens a new text message with the jar's link. */
export async function messageLink(text: string): Promise<void> {
  const body = encodeURIComponent(text);
  await Linking.openURL(Platform.OS === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`);
}

/** More: the system share sheet with the link as text. */
export async function shareLink(text: string): Promise<void> {
  await Share.share({ message: text });
}

/** Share to…: the system share sheet with the card image. */
export async function shareImage(uri: string, dialogTitle: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
}
