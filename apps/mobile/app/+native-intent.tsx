import * as WebBrowser from 'expo-web-browser';

import { incomingLink } from '@/lib/links';

// Universal links (iOS) and app links (Android) for pickld.me, and pickld:// links (FR-WEB-03, M4-15).
// Shared web pages open the matching screen; legal pages open in the browser; other links are unchanged.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const link = incomingLink(path);
    if (link.kind === 'route') return link.href;
    if (link.kind === 'web') {
      void WebBrowser.openBrowserAsync(link.url);
      return null;
    }
    // Anything else is left to Expo Router as before (other pickld:// screens).
    return path;
  } catch {
    return path;
  }
}
