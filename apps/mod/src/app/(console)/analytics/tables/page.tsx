import { redirect } from 'next/navigation';

// Tables became one page per table group; the old address opens Audience with the same window.
export default async function AnalyticsTables({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  redirect(days ? `/analytics/audience?days=${encodeURIComponent(days)}` : '/analytics/audience');
}
