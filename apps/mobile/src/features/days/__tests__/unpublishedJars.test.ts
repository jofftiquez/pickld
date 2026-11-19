import { pickUnpublished, type UnpublishedRow } from '../unpublishedJars';

// 09:00 on Thursday, November 19 in Manila.
const NOW = new Date('2026-11-19T09:00:00+08:00');
const TODAY = '2026-11-19';

const row = (localDate: string, over: Partial<UnpublishedRow> = {}): UnpublishedRow => ({
  id: `j-${localDate}`,
  local_date: localDate,
  tz: 'Asia/Manila',
  ends_at: null,
  moment_count: 3,
  resolved_cover_id: null,
  ...over,
});

describe('pickUnpublished', () => {
  it('keeps yesterday through a week ago, newest first, and drops the eighth day back', () => {
    const picked = pickUnpublished(
      [row('2026-11-12'), row('2026-11-18'), row('2026-11-11'), row('2026-11-15')],
      NOW,
      TODAY,
    );
    expect(picked.map((r) => r.local_date)).toEqual(['2026-11-18', '2026-11-15', '2026-11-12']);
  });

  it('leaves out a jar whose day is still open in its own zone (travel rule) and keeps one that ended', () => {
    // Yesterday in Los Angeles runs until 16:00 Manila time on the 19th; yesterday in Manila ended at midnight.
    const picked = pickUnpublished(
      [row('2026-11-18', { tz: 'America/Los_Angeles', id: 'la' }), row('2026-11-17')],
      NOW,
      TODAY,
    );
    expect(picked.map((r) => r.id)).toEqual(['j-2026-11-17']);
  });

  it('respects a later server ends_at and skips empty jars', () => {
    const picked = pickUnpublished(
      [row('2026-11-18', { ends_at: '2026-11-19T12:00:00+08:00' }), row('2026-11-17', { moment_count: 0 })],
      NOW,
      TODAY,
    );
    expect(picked).toEqual([]);
  });
});
