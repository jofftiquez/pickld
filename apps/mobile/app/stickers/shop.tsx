import { Redirect } from 'expo-router';

// /stickers/shop (FR-STK-06): kept for old links; the Sticker shop is now Shop on the Stickers page (D-61).
export default function StickerShopRedirect() {
  return <Redirect href={{ pathname: '/stickers', params: { tab: 'shop' } }} />;
}
