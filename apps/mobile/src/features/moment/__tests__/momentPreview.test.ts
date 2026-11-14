import type { JarMoment, JarPageData } from '@/features/jar/jarPage';
import { buildTodayGrid, type QueuedMoment, type ServerMoment } from '@/features/jar/todayGrid';

import { buildPreviewItems, canSetCover, canShare, previewActions, resolveIndex } from '../momentPreview';

const live = (slot: ServerMoment['slot'], over: Partial<ServerMoment> = {}): ServerMoment => ({
  id: `m-${slot}`,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: '2026-11-10T00:30:00Z',
  added_at: '2026-11-10T00:31:00Z',
  thumbUrl: `https://photos.test/${slot}-thumb.webp`,
  ...over,
});

const queued = (id: number, slot: QueuedMoment['slot'], state: QueuedMoment['state']): QueuedMoment => ({
  id,
  slot,
  state,
  localDate: '2026-11-10',
  photoUri: `file:///q/${slot}.webp`,
  thumbUri: `file:///q/${slot}-thumb.webp`,
  capturedAt: '2026-11-10T04:30:00Z',
  visibility: null,
  caption: ' Lunch ',
});

function pageMoment(slot: JarMoment['slot'], over: Partial<JarMoment> = {}): JarMoment {
  return {
    id: `m-${slot}`,
    slot,
    status: 'live',
    visibility: 'readers',
    is_backfilled: false,
    caption: null,
    captured_at: '2026-11-10T00:30:00Z',
    added_at: '2026-11-10T00:31:00Z',
    edits: {},
    like_count: 0,
    thumbUrl: null,
    fullUrl: `https://photos.test/${slot}-full.webp`,
    ...over,
  };
}

const moments = [
  live('evening'),
  live('ootd', { visibility: 'only_me' }),
  live('whereami'),
  live('mebusywith', { status: 'checking' }),
  live('afternoon', { status: 'removed' }),
];
const queue = [
  queued(21, 'selfie', 'queued'),
  queued(22, 'morning', 'uploading'),
  queued(23, 'whoamiwith', 'uploaded'),
];
const tiles = buildTodayGrid({ localDate: '2026-11-10', moments, queue, nowSlot: null, jarTz: 'Asia/Manila' });

describe('buildPreviewItems', () => {
  it('swipes through live moments and photos on the phone in slot order, leaving out checking, removed and empty', () => {
    const items = buildPreviewItems({ tiles, queue, jarId: 'jar-10', defaultVisibility: 'everyone' });
    expect(items.map((i) => [i.slot, i.kind, i.uploading])).toEqual([
      ['whereami', 'live', false],
      ['ootd', 'live', false],
      ['selfie', 'queued', false],
      ['morning', 'queued', true],
      ['evening', 'live', false],
    ]);
    // A queued photo at the owner's default shows the default; its caption comes from the queue.
    const selfie = items.find((i) => i.slot === 'selfie');
    expect(selfie).toMatchObject({
      key: 'queue:21',
      visibility: 'everyone',
      caption: 'Lunch',
      target: { kind: 'queued', queueId: 21 },
      likeCount: null,
    });
  });

  it('uses the jar page for the full photo, caption, likes and comments once it has loaded', () => {
    const page: JarPageData = {
      jar: {
        id: 'jar-10',
        user_id: 'me',
        local_date: '2026-11-10',
        tz: 'Asia/Manila',
        moment_count: 3,
        visible_count: 2,
        like_count: 0,
        comment_count: 4,
      },
      author: { username: 'dale', display_name: 'Dale' },
      moments: [pageMoment('whereami', { caption: 'Home', like_count: 7, comment_count: 2 })],
      viewerId: 'me',
      liked: { jar: false, moments: ['m-whereami'] },
    };
    const [first, second] = buildPreviewItems({ tiles, queue, jarId: 'jar-10', page });
    expect(first).toMatchObject({
      uri: 'https://photos.test/whereami-full.webp',
      caption: 'Home',
      likeCount: 7,
      liked: true,
      commentCount: 2,
      target: { kind: 'server', momentId: 'm-whereami', jarId: 'jar-10' },
    });
    // Not in the page yet (or the page hasn't loaded): the thumbnail, and no counts.
    expect(second).toMatchObject({ uri: 'https://photos.test/ootd-thumb.webp', likeCount: null, commentCount: null });
  });

  it('marks the cover the jar page shows (D-56), and nothing before the page has loaded', () => {
    const page: JarPageData = {
      jar: {
        id: 'jar-10',
        user_id: 'me',
        local_date: '2026-11-10',
        tz: 'Asia/Manila',
        moment_count: 3,
        visible_count: 2,
        like_count: 0,
        comment_count: 0,
        resolved_cover_id: 'm-evening',
      },
      author: { username: 'dale', display_name: 'Dale' },
      moments: [pageMoment('whereami', { caption: 'Home' }), pageMoment('evening')],
      viewerId: 'me',
    };
    const items = buildPreviewItems({ tiles, queue, jarId: 'jar-10', page });
    expect(items.filter((i) => i.isCover).map((i) => i.key)).toEqual(['m-evening']);
    expect(buildPreviewItems({ tiles, queue, jarId: 'jar-10' }).some((i) => i.isCover)).toBe(false);
  });
});

describe('canSetCover', () => {
  it('offers Set as cover on a live moment that is not the cover yet', () => {
    expect(canSetCover({ kind: 'live', isCover: false })).toBe(true);
    expect(canSetCover({ kind: 'live', isCover: true })).toBe(false);
    expect(canSetCover({ kind: 'queued', isCover: false })).toBe(false);
  });
});

describe('previewActions', () => {
  it('a live moment has Edit, Share, Visibility, Set as cover (D-98) and More; a photo on the phone only Edit and Delete', () => {
    expect(previewActions({ kind: 'live', uploading: false })).toEqual([
      'edit',
      'share',
      'visibility',
      'cover',
      'more',
    ]);
    expect(previewActions({ kind: 'queued', uploading: false })).toEqual(['edit', 'delete']);
    expect(previewActions({ kind: 'queued', uploading: true })).toEqual([]);
  });

  it('only a live moment that is not Only me can be shared', () => {
    expect(canShare({ kind: 'live', visibility: 'readers' })).toBe(true);
    expect(canShare({ kind: 'live', visibility: 'only_me' })).toBe(false);
    expect(canShare({ kind: 'queued', visibility: 'everyone' })).toBe(false);
  });
});

describe('resolveIndex', () => {
  const items = [
    { key: 'a', slot: 'whereami' as const },
    { key: 'b', slot: 'ootd' as const },
    { key: 'c', slot: 'evening' as const },
  ];
  it('keeps the same moment, else the one in its slot, else the next slot, else the last', () => {
    expect(resolveIndex(items, 'b', 'ootd')).toBe(1);
    expect(resolveIndex(items, 'queue:9', 'ootd')).toBe(1); // uploaded: now a server moment in the same slot
    expect(resolveIndex(items, 'gone', 'selfie')).toBe(2); // deleted: the next one in slot order
    expect(resolveIndex(items.slice(0, 2), 'gone', 'evening')).toBe(1);
    expect(resolveIndex([], 'a', 'whereami')).toBe(-1);
  });
});
