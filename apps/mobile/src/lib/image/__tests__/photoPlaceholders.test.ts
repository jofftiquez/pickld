import { forgetPlaceholders, MAX_PLACEHOLDERS, photoPlaceholder, rememberPlaceholders } from '../photoPlaceholders';

const link = (key: string) => `https://photos.pickld.me/${key}?exp=1800000000&sig=abc`;
const upload = (n: number | string) => `moments/u1/upload-${n}`;
const answer = (moments: unknown[]) => ({ data: { expiresAt: 'x', moments, profiles: [] } });

beforeEach(forgetPlaceholders);

describe('photo placeholders (NFR-PERF-02)', () => {
  it('one hash covers the full, medium and thumb links of the same upload, whatever their signature', () => {
    rememberPlaceholders(answer([{ id: 'm1', thumb: link(`${upload(1)}/thumb.jpg`), thumbhash: 'HASHone1' }]));
    for (const size of ['full', 'medium', 'thumb']) {
      expect(photoPlaceholder(`https://photos.pickld.me/${upload(1)}/${size}.jpg?sig=other&exp=1`)).toEqual({
        thumbhash: 'HASHone1',
      });
    }
    expect(photoPlaceholder(link(`${upload(2)}/full.jpg`))).toBeUndefined();
  });

  it('keeps the pending photo’s hash under its own upload, apart from the live one', () => {
    rememberPlaceholders(
      answer([
        {
          id: 'm1',
          thumb: link(`${upload('live')}/thumb.jpg`),
          thumbhash: 'LIVEhash',
          pendingThumb: link(`${upload('new')}/thumb.jpg`),
          pendingThumbhash: 'NEWhash1',
        },
      ]),
    );
    expect(photoPlaceholder(link(`${upload('live')}/medium.jpg`))).toEqual({ thumbhash: 'LIVEhash' });
    expect(photoPlaceholder(link(`${upload('new')}/full.jpg`))).toEqual({ thumbhash: 'NEWhash1' });
  });

  it('has none for local files, links without a hash, or answers it can’t read', () => {
    rememberPlaceholders(
      answer([
        { id: 'm1', thumb: link(`${upload(3)}/thumb.jpg`) },
        { id: 'm2', thumb: null },
      ]),
    );
    rememberPlaceholders({ error: { code: 'unauthorized' } });
    rememberPlaceholders(answer(['not a moment', { thumb: 42, thumbhash: 'HASHbad1' }]));
    expect(photoPlaceholder(link(`${upload(3)}/full.jpg`))).toBeUndefined();
    expect(photoPlaceholder('file:///cache/queue/full.webp')).toBeUndefined();
    expect(photoPlaceholder(null)).toBeUndefined();
  });

  it('forgets the least recently seen upload first once full', () => {
    rememberPlaceholders(
      answer(
        Array.from({ length: MAX_PLACEHOLDERS }, (_, i) => ({
          id: `m${i}`,
          thumb: link(`${upload(i)}/thumb.jpg`),
          thumbhash: `HASH${i}xxxx`,
        })),
      ),
    );
    // Seen again: now the most recent, so upload 1 is the oldest.
    rememberPlaceholders(answer([{ id: 'm0', thumb: link(`${upload(0)}/thumb.jpg`), thumbhash: 'HASH0xxxx' }]));
    rememberPlaceholders(answer([{ id: 'new', thumb: link(`${upload('new')}/thumb.jpg`), thumbhash: 'HASHnewxx' }]));

    expect(photoPlaceholder(link(`${upload(1)}/thumb.jpg`))).toBeUndefined();
    expect(photoPlaceholder(link(`${upload(0)}/thumb.jpg`))).toEqual({ thumbhash: 'HASH0xxxx' });
    expect(photoPlaceholder(link(`${upload(2)}/thumb.jpg`))).toEqual({ thumbhash: 'HASH2xxxx' });
    expect(photoPlaceholder(link(`${upload('new')}/thumb.jpg`))).toEqual({ thumbhash: 'HASHnewxx' });
  });
});
