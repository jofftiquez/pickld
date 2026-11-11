import { DEFAULT_EDITS } from '@/features/edit/edits';
import { currentSlot } from '@/lib/jars';
import { slots } from '@/theme/tokens';

import {
  buildTodayGrid,
  greetingFor,
  holdsSlot,
  momentCount,
  offlineBannerCount,
  type QueuedMoment,
  type ServerMoment,
} from '../todayGrid';

const DATE = '2026-11-09';
const TZ = 'Asia/Manila';

function moment(slot: ServerMoment['slot'], over: Partial<ServerMoment> = {}): ServerMoment {
  return {
    id: `m-${slot}`,
    slot,
    status: 'live',
    is_private: false,
    is_backfilled: false,
    captured_at: '2026-11-09T04:30:00Z',
    added_at: '2026-11-09T04:31:00Z',
    thumbUrl: `https://photos.test/${slot}.webp`,
    ...over,
  };
}

let nextId = 1;
function queued(slot: QueuedMoment['slot'], over: Partial<QueuedMoment> = {}): QueuedMoment {
  return {
    id: nextId++,
    slot,
    state: 'queued',
    localDate: DATE,
    photoUri: `file:///queue/${slot}.webp`,
    thumbUri: `file:///queue/${slot}-thumb.webp`,
    capturedAt: '2026-11-09T05:00:00Z',
    isPrivate: false,
    ...over,
  };
}

/** Manila wall-clock time on DATE as an instant. */
const at = (hhmm: string) => new Date(`${DATE}T${hhmm}:00+08:00`);

function grid(over: Partial<Parameters<typeof buildTodayGrid>[0]> = {}) {
  return buildTodayGrid({ localDate: DATE, moments: [], queue: [], nowSlot: null, ...over });
}

const stateOf = (tiles: ReturnType<typeof grid>, slot: string) => tiles.find((t) => t.slot === slot)?.state;
const nowTiles = (tiles: ReturnType<typeof grid>) => tiles.filter((t) => t.state === 'now').map((t) => t.slot);

describe('buildTodayGrid: order', () => {
  it('always returns the 8 slots in the fixed order, whatever order the data comes in', () => {
    const tiles = grid({
      moments: [moment('evening'), moment('whereami'), moment('selfie')],
      queue: [queued('afternoon'), queued('mebusywith')],
    });
    expect(tiles.map((t) => t.slot)).toEqual([
      'whereami',
      'mebusywith',
      'whoamiwith',
      'ootd',
      'selfie',
      'morning',
      'afternoon',
      'evening',
    ]);
  });

  it('an empty day is 8 empty tiles', () => {
    expect(grid().map((t) => t.state)).toEqual(Array(8).fill('empty'));
  });
});

describe('buildTodayGrid: merging server moments with the queue', () => {
  it('shows server moments: live as filled, checking and uploading as checking', () => {
    const tiles = grid({
      moments: [moment('whereami'), moment('ootd', { status: 'checking' }), moment('selfie', { status: 'uploading' })],
    });
    expect(stateOf(tiles, 'whereami')).toBe('filled');
    expect(stateOf(tiles, 'ootd')).toBe('checking');
    expect(stateOf(tiles, 'selfie')).toBe('checking');
    expect(tiles[0]).toMatchObject({
      uri: 'https://photos.test/whereami.webp',
      time: '2026-11-09T04:30:00Z',
      momentId: 'm-whereami',
      queueId: null,
    });
  });

  it('a removed server moment shows as removed with its id and thumbnail, so it can open the notice', () => {
    const tiles = grid({ moments: [moment('ootd', { status: 'removed', is_private: true })] });
    expect(tiles[3]).toEqual({
      slot: 'ootd',
      state: 'removed',
      uri: 'https://photos.test/ootd.webp',
      time: null,
      isPrivate: false,
      addedLater: false,
      momentId: 'm-ootd',
      queueId: null,
      canRetry: false,
      // Its edits are never drawn: the photo stays plain and blurred.
      edits: DEFAULT_EDITS,
      stamp: null,
    });
  });

  it('a removed moment in the current slot shows as removed, and no other slot becomes Now', () => {
    const tiles = grid({ moments: [moment('morning', { status: 'removed' })], nowSlot: 'morning' });
    expect(stateOf(tiles, 'morning')).toBe('removed');
    expect(nowTiles(tiles)).toEqual([]);
  });

  it.each(['queued', 'uploading', 'failed', 'uploaded', 'conflict'] as const)(
    'a %s queue item (the slot filled again) wins over a removed moment',
    (state) => {
      const item = queued('ootd', { state });
      const tile = grid({ moments: [moment('ootd', { status: 'removed' })], queue: [item] })[3];
      expect(tile).toMatchObject({ queueId: item.id, momentId: null, uri: item.thumbUri });
      expect(tile?.state).not.toBe('removed');
    },
  );

  it('a live or checking moment wins over a removed one in the same slot', () => {
    const removed = moment('ootd', { id: 'm-old', status: 'removed' });
    expect(grid({ moments: [removed, moment('ootd', { id: 'm-new' })] })[3]).toMatchObject({
      state: 'filled',
      momentId: 'm-new',
    });
    expect(grid({ moments: [removed, moment('ootd', { id: 'm-new', status: 'checking' })] })[3]).toMatchObject({
      state: 'checking',
      momentId: 'm-new',
    });
  });

  it.each([
    ['queued', 'waiting'],
    ['uploading', 'uploading'],
    ['failed', 'failed'],
  ] as const)('a %s queue item fills an empty slot as %s with the local photo', (state, tile) => {
    const item = queued('whoamiwith', { state });
    const [, , whoamiwith] = grid({ queue: [item] });
    expect(whoamiwith).toMatchObject({
      state: tile,
      uri: item.thumbUri,
      time: item.capturedAt,
      queueId: item.id,
      momentId: null,
    });
  });

  it.each(['queued', 'uploading', 'failed'] as const)(
    'a %s queue item wins over the server moment it is replacing',
    (state) => {
      const tiles = grid({ moments: [moment('ootd')], queue: [queued('ootd', { state })] });
      expect(stateOf(tiles, 'ootd')).not.toBe('filled');
      expect(tiles[3]?.momentId).toBeNull();
    },
  );

  it('the server moment wins once the queue item is uploaded', () => {
    const tiles = grid({ moments: [moment('ootd')], queue: [queued('ootd', { state: 'uploaded' })] });
    expect(tiles[3]).toMatchObject({ state: 'filled', momentId: 'm-ootd', uri: 'https://photos.test/ootd.webp' });
  });

  it('a slot conflict keeps the existing server moment showing until Replace (M2-22)', () => {
    const tiles = grid({ moments: [moment('ootd')], queue: [queued('ootd', { state: 'conflict' })] });
    expect(tiles[3]).toMatchObject({ state: 'filled', momentId: 'm-ootd', queueId: null });
  });

  it('a slot conflict whose server moment is gone shows the local photo as failed', () => {
    const item = queued('ootd', { state: 'conflict' });
    expect(grid({ queue: [item] })[3]).toMatchObject({ state: 'failed', uri: item.thumbUri, queueId: item.id });
  });

  it('an uploaded item whose server moment has not loaded yet shows as checking with the local photo', () => {
    const item = queued('ootd', { state: 'uploaded' });
    expect(grid({ queue: [item] })[3]).toMatchObject({ state: 'checking', uri: item.thumbUri });
  });

  it('falls back to the full photo when the queue item has no thumbnail', () => {
    const item = queued('selfie', { thumbUri: null });
    expect(grid({ queue: [item] })[4]?.uri).toBe(item.photoUri);
  });

  it('ignores queue items for another date (a past jar)', () => {
    expect(stateOf(grid({ queue: [queued('ootd', { localDate: '2026-11-08' })] }), 'ootd')).toBe('empty');
  });

  it('the newest queue item for a slot wins', () => {
    const older = queued('selfie', { state: 'failed' });
    const newer = queued('selfie', { state: 'uploading' });
    expect(grid({ queue: [newer, older] })[4]).toMatchObject({ state: 'uploading', queueId: newer.id });
  });

  it('keeps the private and Added later flags', () => {
    const tiles = grid({
      moments: [moment('whereami', { is_private: true, is_backfilled: true })],
      queue: [queued('evening', { isPrivate: true })],
    });
    expect(tiles[0]).toMatchObject({ isPrivate: true, addedLater: true });
    expect(tiles[7]).toMatchObject({ isPrivate: true, addedLater: false });
  });

  it('uses added_at when the moment has no capture time', () => {
    expect(grid({ moments: [moment('ootd', { captured_at: null })] })[3]?.time).toBe('2026-11-09T04:31:00Z');
  });
});

describe('buildTodayGrid: the Now tile', () => {
  it.each([
    ['05:00', 'morning'],
    ['11:59', 'morning'],
    ['12:00', 'afternoon'],
    ['17:59', 'afternoon'],
    ['18:00', 'evening'],
    ['23:59', 'evening'],
  ] as const)('at %s only %s is the Now tile', (time, slot) => {
    expect(nowTiles(grid({ nowSlot: currentSlot(at(time), TZ) }))).toEqual([slot]);
  });

  it.each(['00:00', '03:00', '04:59'])('there is no Now tile at %s', (time) => {
    const tiles = grid({ nowSlot: currentSlot(at(time), TZ) });
    expect(nowTiles(tiles)).toEqual([]);
    expect(tiles.map((t) => t.state)).toEqual(Array(8).fill('empty'));
  });

  it('the evening slot (the 8th tile) is Now at 23:59 and the last tile in the grid', () => {
    const tiles = grid({ nowSlot: currentSlot(at('23:59'), TZ) });
    expect(tiles[7]).toMatchObject({ slot: 'evening', state: 'now' });
    expect(tiles.slice(0, 7).every((t) => t.state === 'empty')).toBe(true);
  });

  it('a filled or queued current slot is not the Now tile, and no other slot takes its place', () => {
    expect(nowTiles(grid({ nowSlot: 'afternoon', moments: [moment('afternoon')] }))).toEqual([]);
    expect(nowTiles(grid({ nowSlot: 'evening', queue: [queued('evening')] }))).toEqual([]);
  });

  it('never shows more than one Now tile', () => {
    for (const nowSlot of ['morning', 'afternoon', 'evening', null] as const) {
      expect(nowTiles(grid({ nowSlot })).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('momentCount', () => {
  it('counts every tile with a photo, including queued and checking ones', () => {
    const tiles = grid({
      nowSlot: 'afternoon',
      moments: [
        moment('whereami'),
        moment('mebusywith', { status: 'checking' }),
        moment('ootd', { status: 'removed' }),
      ],
      queue: [queued('selfie', { state: 'failed' }), queued('morning')],
    });
    expect(momentCount(tiles)).toBe(4);
  });

  it('a full jar is 8 of 8', () => {
    expect(momentCount(grid({ moments: slots.map((s) => moment(s)) }))).toBe(8);
  });

  it('empty and Now tiles do not count', () => {
    expect(momentCount(grid({ nowSlot: 'morning' }))).toBe(0);
  });

  it('removed tiles do not count (the server moment_count, D-9)', () => {
    expect(momentCount(grid({ moments: [moment('ootd', { status: 'removed' })] }))).toBe(0);
  });
});

describe('holdsSlot (the camera can fill free slots)', () => {
  it('empty, Now and removed tiles leave the slot free; photo tiles hold it', () => {
    const tiles = grid({
      nowSlot: 'morning',
      moments: [
        moment('whereami'),
        moment('mebusywith', { status: 'checking' }),
        moment('ootd', { status: 'removed' }),
      ],
      queue: [queued('selfie', { state: 'failed' }), queued('evening')],
    });
    expect(tiles.filter(holdsSlot).map((t) => t.slot)).toEqual(['whereami', 'mebusywith', 'selfie', 'evening']);
  });
});

describe('Retry on failed tiles', () => {
  it('only a failed queue item offers Retry; a conflict waits for Replace', () => {
    const tiles = grid({
      queue: [
        queued('whereami', { state: 'failed' }),
        queued('ootd', { state: 'conflict' }),
        queued('selfie', { state: 'queued' }),
        queued('morning', { state: 'uploading' }),
      ],
      moments: [moment('evening')],
    });
    expect(tiles.filter((t) => t.canRetry).map((t) => t.slot)).toEqual(['whereami']);
    expect(stateOf(tiles, 'ootd')).toBe('failed');
  });
});

describe('offlineBannerCount', () => {
  it('counts waiting and uploading moments of any date while offline', () => {
    const queue = [
      queued('whereami'),
      queued('selfie', { state: 'uploading' }),
      queued('ootd', { localDate: '2026-11-08' }), // yesterday's, still on the phone
    ];
    expect(offlineBannerCount(queue, true)).toBe(3);
  });

  it('leaves out failed (needs Retry), conflict (needs Replace) and uploaded (on the server)', () => {
    const queue = [
      queued('whereami'),
      queued('selfie', { state: 'failed' }),
      queued('ootd', { state: 'conflict' }),
      queued('morning', { state: 'uploaded' }),
    ];
    expect(offlineBannerCount(queue, true)).toBe(1);
  });

  it('hides the banner while online, and when nothing is waiting', () => {
    expect(offlineBannerCount([queued('whereami')], false)).toBeNull();
    expect(offlineBannerCount([], true)).toBeNull();
    expect(offlineBannerCount([queued('selfie', { state: 'failed' })], true)).toBeNull();
  });
});

describe('greetingFor', () => {
  it('follows the time of day, and late night is still evening', () => {
    expect(greetingFor('morning')).toBe('morning');
    expect(greetingFor('afternoon')).toBe('afternoon');
    expect(greetingFor('evening')).toBe('evening');
    expect(greetingFor(null)).toBe('evening');
  });
});

describe('buildTodayGrid: edits and stamps for the moment renderer (M2-18)', () => {
  const overlay = { id: 'b1', type: 'bubble', text: 'hi', x: 0.5, y: 0.5, scale: 0.5, rotation: 0 };

  it('server moments carry their parsed edits and stamp in the jar’s zone; bad or missing edits are plain', () => {
    const tiles = grid({
      jarTz: 'Asia/Tokyo',
      moments: [
        moment('whereami', { edits: { v: 1, filter: 'mono', overlays: [overlay] } }),
        moment('ootd', { edits: { filter: 'neon', overlays: 'x' } }),
        moment('selfie'),
      ],
    });
    expect(tiles[0]?.edits).toMatchObject({ filter: 'mono', overlays: [{ id: 'b1', shape: 'speech' }] });
    expect(tiles[0]?.stamp).toEqual({ capturedAt: new Date('2026-11-09T04:30:00Z'), tz: 'Asia/Tokyo' });
    expect(tiles[3]?.edits).toEqual(DEFAULT_EDITS);
    expect(tiles[4]?.edits).toEqual(DEFAULT_EDITS);
    // Without the jar's zone the stamps show their art rather than a time in the wrong zone.
    expect(grid({ moments: [moment('selfie')] })[4]?.stamp).toBeNull();
  });

  it('queued items carry their local edits, stamped with the capture time or else when they were queued', () => {
    const queuedAt = Date.parse('2026-11-09T06:00:00Z');
    const tiles = grid({
      queue: [
        queued('whereami', { tz: TZ, createdAt: queuedAt, edits: { v: 1, filter: 'dusk', overlays: [overlay] } }),
        queued('ootd', { tz: TZ, createdAt: queuedAt, capturedAt: null }),
        queued('selfie'),
      ],
    });
    expect(tiles[0]?.edits).toMatchObject({ filter: 'dusk', overlays: [{ id: 'b1' }] });
    expect(tiles[0]?.stamp).toEqual({ capturedAt: new Date('2026-11-09T05:00:00Z'), tz: TZ });
    expect(tiles[3]?.stamp).toEqual({ capturedAt: new Date(queuedAt), tz: TZ });
    expect(tiles[3]?.edits).toEqual(DEFAULT_EDITS);
    expect(tiles[4]?.stamp).toBeNull();
  });
});
