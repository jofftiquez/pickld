import { canDelete, exportCard } from '../deleteModel';

describe('canDelete', () => {
  it.each([
    ['DELETE', true],
    ['  DELETE ', true],
    ['delete', false],
    ['Delete', false],
    ['DELET', false],
    ['DELETE!', false],
    ['', false],
  ])('%j → %s', (typed, ok) => expect(canDelete(typed)).toBe(ok));
});

describe('exportCard', () => {
  const base = { requestedAt: '2026-11-12T10:00:00Z', url: null, expiresAt: null };
  it('maps each status', () => {
    expect(exportCard(undefined)).toEqual({ kind: 'none' });
    expect(exportCard({ ...base, status: 'none', requestedAt: null })).toEqual({ kind: 'none' });
    expect(exportCard({ ...base, status: 'pending' })).toEqual({ kind: 'preparing' });
    expect(exportCard({ ...base, status: 'running' })).toEqual({ kind: 'preparing' });
    expect(exportCard({ ...base, status: 'failed' })).toEqual({ kind: 'failed' });
    expect(
      exportCard({ ...base, status: 'done', url: 'https://x.test/e.zip', expiresAt: '2026-11-13T10:00:00Z' }),
    ).toEqual({ kind: 'ready', url: 'https://x.test/e.zip', expiresAt: '2026-11-13T10:00:00Z' });
  });
  it('a done job without a link offers Try again', () => {
    expect(exportCard({ ...base, status: 'done' })).toEqual({ kind: 'failed' });
  });
});
