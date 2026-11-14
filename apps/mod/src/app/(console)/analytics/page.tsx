import { redirect } from 'next/navigation';

// Analytics is a group of pages (Charts, Audience, Packs, Top stickers); the old address opens Charts with the same window.
export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  redirect(days ? `/analytics/charts?days=${encodeURIComponent(days)}` : '/analytics/charts');
}
