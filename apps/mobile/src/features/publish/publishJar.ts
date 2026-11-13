// Publish review (M3-01; FR-PUB-01, FR-PUB-03, rule 1). Publishing is one owner update of the jar's
// visibility and published_at; the jars trigger (0003) lets an owner change only those, stamps
// published_at with the server clock and keeps the first stamp when a published jar is published again.
// RLS hides other users' jars, so "no row changed" means the jar isn't the caller's.
import type { SupabaseClient } from '@supabase/supabase-js';

import { holdsSlot, type GridTile } from '@/features/jar/todayGrid';
import type { Database } from '@/lib/database.types';
import type { Visibility } from '@/lib/visibility';

export { VISIBILITIES, type Visibility } from '@/lib/visibility';

export type JarsClient = Pick<SupabaseClient<Database>, 'from'>;

/** `refused`: not the caller's jar, or the server said no. `failed`: anything else, usually no connection. */
export class PublishError extends Error {
  constructor(
    readonly reason: 'refused' | 'failed',
    cause?: unknown,
  ) {
    super(`Publish failed: ${reason}`, { cause });
    this.name = 'PublishError';
  }
}

const INSUFFICIENT_PRIVILEGE = '42501';

/** Publishes the owner's jar with `visibility`; returns the server's published_at. */
export async function publishJar(client: JarsClient, jarId: string, visibility: Visibility): Promise<string> {
  // The trigger replaces this timestamp with now(); it only has to be non-null.
  const { data, error } = await client
    .from('jars')
    .update({ visibility, published_at: new Date().toISOString() })
    .eq('id', jarId)
    .select('published_at');
  if (error) throw new PublishError(error.code === INSUFFICIENT_PRIVILEGE ? 'refused' : 'failed', error);
  const publishedAt = data?.[0]?.published_at;
  if (!publishedAt) throw new PublishError('refused');
  return publishedAt;
}

/**
 * The note under the visibility choice: Only me moments that stay with the owner and empty slots that can
 * still be filled today. Removed moments leave their slot free (D-27), so they count as missing.
 */
export function publishNote(tiles: readonly Pick<GridTile, 'state' | 'visibility'>[]): {
  privateCount: number;
  missingCount: number;
} {
  return {
    privateCount: tiles.filter((tile) => holdsSlot(tile) && tile.visibility === 'only_me').length,
    missingCount: tiles.filter((tile) => !holdsSlot(tile)).length,
  };
}
