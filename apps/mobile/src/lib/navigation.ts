import type { Href, ImperativeRouter } from 'expo-router';

/**
 * Starts the root stack over at `href`: drops every screen below the current one, then replaces it.
 * Use it where one part of the app hands over to another (setup finished → Today, signed out → Welcome),
 * so an iOS back swipe can't return to the part that was left. `replace` alone swaps only the top screen.
 */
export function resetTo(router: Pick<ImperativeRouter, 'canDismiss' | 'dismissAll' | 'replace'>, href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
