import type { JarMoment } from '@/features/jar/jarPage';

import { buildShareCard } from '../shareCard';

const moment = (over: Partial<JarMoment>): JarMoment => ({
  id: over.slot ?? 'm',
  slot: 'morning',
  status: 'live',
  is_private: false,
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
  it('never includes a private moment, even for its owner, nor its caption; the rest go in slot order', () => {
    const card = buildShareCard(
      {
        author,
        moments: [
          moment({ slot: 'evening', caption: 'Early night.', added_at: '2026-11-08T12:00:00Z' }),
          moment({ slot: 'selfie', is_private: true, caption: 'Secret', added_at: '2026-11-08T13:00:00Z' }),
          moment({ slot: 'whereami' }),
          moment({ slot: 'ootd', status: 'checking', caption: 'Not checked yet', added_at: '2026-11-08T14:00:00Z' }),
        ],
      },
      { includeCaption: true },
    );
    expect(card.moments.map((m) => m.slot)).toEqual(['whereami', 'evening']);
    // The newest caption overall is on the private moment; the card falls back to the newest visible one.
    expect(card.caption).toBe('Early night.');
    expect(card.link).toBe('pickld.me/dale');
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
