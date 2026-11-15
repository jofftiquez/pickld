import { groupPending, pendingCount, type PendingItem } from '../pendingGroups';

const item = (over: Partial<PendingItem> & Pick<PendingItem, 'id'>): PendingItem => ({
  slot: 'morning',
  localDate: '2026-11-15',
  tz: 'Asia/Manila',
  photoUri: `file:///photo-${over.id}.webp`,
  thumbUri: null,
  state: 'queued',
  draft: false,
  editingSince: null,
  ...over,
});

describe('pending uploads', () => {
  const queue: PendingItem[] = [
    item({ id: 1, localDate: '2026-11-09', slot: 'evening', state: 'failed', thumbUri: 'file:///thumb-1.webp' }),
    item({ id: 2, localDate: '2026-11-15', slot: 'selfie', state: 'uploaded' }),
    item({ id: 3, localDate: '2026-11-15', slot: 'ootd', draft: true }),
    item({ id: 4, localDate: '2026-11-15', slot: 'whereami', state: 'uploading' }),
    // Held by the editor (killed mid-edit, not yet turned into a draft): unfinished, so it reads as a draft.
    item({ id: 5, localDate: '2026-11-12', slot: 'afternoon', editingSince: 1_000 }),
    item({ id: 6, localDate: '2026-11-12', slot: 'whereami', state: 'conflict', tz: 'Asia/Tokyo' }),
    item({ id: 7, localDate: '2026-11-15', slot: 'mebusywith' }),
  ];

  it('groups everything not yet uploaded by day, newest day first, rows in slot order', () => {
    const days = groupPending(queue);
    expect(days.map((d) => d.localDate)).toEqual(['2026-11-15', '2026-11-12', '2026-11-09']);
    expect(days[0]?.rows.map((r) => [r.slot, r.status])).toEqual([
      ['whereami', 'uploading'],
      ['mebusywith', 'waiting'],
      ['ootd', 'draft'],
    ]);
    expect(days[1]?.rows.map((r) => [r.slot, r.status])).toEqual([
      ['whereami', 'conflict'],
      ['afternoon', 'draft'],
    ]);
    expect(days[2]?.rows).toEqual([
      // The thumbnail when there is one, else the photo.
      {
        id: 1,
        slot: 'evening',
        localDate: '2026-11-09',
        tz: 'Asia/Manila',
        uri: 'file:///thumb-1.webp',
        status: 'failed',
      },
    ]);
    expect(days[0]?.rows[1]?.uri).toBe('file:///photo-7.webp');
  });

  it('counts the pending ones only: an uploaded row waiting to be cleared is not pending', () => {
    expect(pendingCount(queue)).toBe(6);
    expect(pendingCount([item({ id: 9, state: 'uploaded' })])).toBe(0);
    expect(groupPending([item({ id: 9, state: 'uploaded' })])).toEqual([]);
  });
});
