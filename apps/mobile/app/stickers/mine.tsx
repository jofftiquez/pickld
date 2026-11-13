import { Redirect } from 'expo-router';

// /stickers/mine (FR-STK-08): kept for old links; My stickers is now Mine on the Stickers page (D-61).
export default function MyStickersRedirect() {
  return <Redirect href={{ pathname: '/stickers', params: { tab: 'mine' } }} />;
}
