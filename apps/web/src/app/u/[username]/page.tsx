import { permanentRedirect } from 'next/navigation';

// pickld.me/u/<username> (architecture's format) redirects to the canonical pickld.me/<username> (C-2).
export default async function LegacyProfile({ params }: { params: Promise<{ username: string }> }) {
  permanentRedirect(`/${encodeURIComponent(decodeURIComponent((await params).username))}`);
}
