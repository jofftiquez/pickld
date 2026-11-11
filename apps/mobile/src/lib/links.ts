// Public web links (apps/web). Shared profile pages live at pickld.me/<username>, jars at pickld.me/j/<id> (C-2).
export const WEB_BASE_URL = 'https://pickld.me';

export function profileUrl(username: string): string {
  return `${WEB_BASE_URL}/${encodeURIComponent(username)}`;
}

export function jarUrl(jarId: string): string {
  return `${WEB_BASE_URL}/j/${encodeURIComponent(jarId)}`;
}
