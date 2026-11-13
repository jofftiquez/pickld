import { z } from 'zod';

// Public web links (apps/web). Shared profile pages live at pickld.me/<username>, jars at pickld.me/j/<id> (C-2).
export const WEB_BASE_URL = 'https://pickld.me';
const WEB_HOSTS = new Set(['pickld.me', 'www.pickld.me']);

export function profileUrl(username: string): string {
  return `${WEB_BASE_URL}/${encodeURIComponent(username)}`;
}

export function jarUrl(jarId: string): string {
  return `${WEB_BASE_URL}/j/${encodeURIComponent(jarId)}`;
}

// Same rule as the profiles.username check (0001).
const username = z.string().regex(/^[A-Za-z0-9._]{3,20}$/);
const jarId = z.uuid();
/** Pages that stay on the web even when the app is installed (FR-PRV-04). */
export const WEB_ONLY_PATHS = ['/terms', '/privacy', '/guidelines'] as const;

export type IncomingLink =
  | { kind: 'route'; href: string }
  | { kind: 'web'; url: string } // open in the browser
  | { kind: 'unknown' };

/**
 * Where an incoming link goes in the app (FR-WEB-03, M4-15): a universal link / app link
 * (https://pickld.me/…) or the app's own scheme (pickld://…). Web pages map to the matching screen:
 *   /<username>, /u/<username>  → /u/<username>
 *   /j/<id>                     → /jar/<id>
 *   /auth/callback?…            → /auth/callback?… (Apple and Google sign-in)
 * Anything else on pickld.me is unknown; legal pages open in the browser.
 */
export function incomingLink(raw: string): IncomingLink {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'unknown' };
  }
  const isWeb = (url.protocol === 'https:' || url.protocol === 'http:') && WEB_HOSTS.has(url.hostname);
  const isApp = url.protocol === 'pickld:';
  if (!isWeb && !isApp) return { kind: 'unknown' };
  // pickld://jar/<id> parses with "jar" as the host; put it back in front of the path.
  const path = isApp ? `/${url.host}${url.pathname}`.replace(/\/+$/, '') : url.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (isWeb && (WEB_ONLY_PATHS as readonly string[]).includes(path)) return { kind: 'web', url: url.toString() };
  if (parts[0] === 'auth' && parts[1] === 'callback' && parts.length === 2) {
    return { kind: 'route', href: `/auth/callback${url.search}` };
  }
  if ((parts[0] === 'j' || parts[0] === 'jar') && parts.length === 2 && jarId.safeParse(parts[1]).success) {
    return { kind: 'route', href: `/jar/${parts[1]!.toLowerCase()}` };
  }
  const name = parts[0] === 'u' && parts.length === 2 ? parts[1] : parts.length === 1 ? parts[0] : undefined;
  if (isWeb && name !== undefined && username.safeParse(name).success) {
    return { kind: 'route', href: `/u/${name}` };
  }
  if (isApp && parts[0] === 'u' && parts.length === 2 && username.safeParse(parts[1]).success) {
    return { kind: 'route', href: `/u/${parts[1]}` };
  }
  return { kind: 'unknown' };
}

/** Where Contact support and Send feedback write to (FR-SET-02). */
export const SUPPORT_EMAIL = 'support@pickld.me';
export const GUIDELINES_URL = `${WEB_BASE_URL}/guidelines`;
