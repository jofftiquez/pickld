// Who can see a moment or a jar (D-48, FR-PUB-02): Readers, Everyone or Only me. A moment has its own
// visibility, starting at the owner's default; the database decides who sees it (can_view_moment, 0066).
import { z } from 'zod';

import type { Database } from '@/lib/database.types';

export type Visibility = Database['public']['Enums']['jar_visibility'];

/** In the order the app lists them (Publish review, the editor, Moment options). */
export const VISIBILITIES = ['readers', 'everyone', 'only_me'] as const satisfies readonly Visibility[];

export const visibilitySchema = z.enum(VISIBILITIES);

/** The i18n key part for each visibility (`publish.readers`, `publish.onlyMe`, …). */
export const VISIBILITY_KEY = { readers: 'readers', everyone: 'everyone', only_me: 'onlyMe' } as const;
