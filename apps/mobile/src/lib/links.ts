// Public web links (apps/web). Shared profile pages live at pickld.me/<username>.
export const WEB_BASE_URL = 'https://pickld.me';

export function profileUrl(username: string): string {
  return `${WEB_BASE_URL}/${encodeURIComponent(username)}`;
}
