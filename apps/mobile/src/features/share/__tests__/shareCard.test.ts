import type { JarMoment } from '@/features/jar/jarPage';

import { buildShareCard } from '../shareCard';

const moment = (over: Partial<JarMoment>): JarMoment => ({
  id: over.slot ?? 'm',
  slot: 'morning',
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  caption: null,
  captured_at: null,
  added_at: '2026-11-08T01:00:00Z',
  edits: null,
  like_count: 0,
  thumbUrl: 'https://cdn/t.jpg',
  fullUrl: 'https://cdn/f.jpg',
  ...over,
});

const author = { username: 'dale', display_name: 'Dale Santos' };

describe('Share jar card (FR-SOC-10, FR-PUB-05)', () => {
  it('never includes a private moment, even for its owner, nor its caption; the cover goes first', () => {
    const card = buildShareCard(
      {
        author,
        moments: [
          moment({ slot: 'evening', caption: 'Early night.', added_at: '2026-11-08T12:00:00Z' }),
          moment({ slot: 'selfie', visibility: 'only_me', caption: 'Secret', added_at: '2026-11-08T13:00:00Z' }),
          moment({ slot: 'whereami' }),
          moment({ slot: 'ootd', status: 'checking', caption: 'Not checked yet', added_at: '2026-11-08T14:00:00Z' }),
        ],
      },
      { includeCaption: true },
    );
    // No pick: the newest visible caption is the cover (D-56), then slot order.
    expect(card.moments.map((m) => m.slot)).toEqual(['evening', 'whereami']);
    // The newest caption overall is on the private moment; the card falls back to the newest visible one.
    expect(card.caption).toBe('Early night.');
    expect(card.link).toBe('pickld.me/dale');
  });

  it('puts the owner’s pick first, then slot order; an Only me pick falls back to the cover rule (D-56)', () => {
    const moments = [
      moment({ slot: 'evening' }),
      moment({ slot: 'whereami' }),
      moment({ slot: 'ootd', caption: 'Fit check' }),
      moment({ slot: 'selfie', visibility: 'only_me' }),
    ];
    const picked = buildShareCard({ author, moments, coverId: 'evening' }, { includeCaption: true });
    expect(picked.moments.map((m) => m.slot)).toEqual(['evening', 'whereami', 'ootd']);
    const hidden = buildShareCard({ author, moments, coverId: 'selfie' }, { includeCaption: true });
    expect(hidden.moments.map((m) => m.slot)).toEqual(['ootd', 'whereami', 'evening']);
    const plain = buildShareCard(
      { author, moments: [moment({ slot: 'evening' }), moment({ slot: 'whereami' })] },
      {
        includeCaption: true,
      },
    );
    expect(plain.moments.map((m) => m.slot)).toEqual(['whereami', 'evening']);
  });

  it('Include captions off leaves the caption out', () => {
    const card = buildShareCard({ author, moments: [moment({ caption: 'Hi' })] }, { includeCaption: false });
    expect(card.caption).toBeNull();
  });

  it('a jar whose only captions are blank shows none', () => {
    const card = buildShareCard({ author, moments: [moment({ caption: '   ' })] }, { includeCaption: true });
    expect(card.caption).toBeNull();
  });
});
