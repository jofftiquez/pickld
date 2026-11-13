import { ageLabel, buildSections, pushTarget, targetOf, type NotificationRow } from '../notificationsModel';

const TZ = 'Asia/Manila';
// Thu 2026-11-12 15:00 in Manila.
const NOW = new Date('2026-11-12T07:00:00Z');

const aya = { id: 'a', username: 'aya', display_name: 'Aya' };
const jun = { id: 'j', username: 'jun', display_name: 'Jun' };
const mika = { id: 'm', username: 'mika', display_name: 'Mika Reyes' };

function row(over: Partial<NotificationRow> & Pick<NotificationRow, 'id' | 'type' | 'created_at'>): NotificationRow {
  return {
    read_at: null,
    jar_id: null,
    moment_id: null,
    comment_id: null,
    actor: null,
    jar: null,
    comment: null,
    ...over,
  };
}

describe('buildSections', () => {
  it('groups by the local day in the phone zone, not UTC', () => {
    // 00:30 Manila on the 12th is still the 11th in UTC: it belongs to Today.
    const rows = [
      row({ id: '1', type: 'new_reader', actor: mika, created_at: '2026-11-11T16:30:00Z' }),
      // 23:30 Manila on the 11th: This week.
      row({ id: '2', type: 'new_reader', actor: aya, created_at: '2026-11-11T15:30:00Z' }),
      // 8 days ago: Earlier.
      row({ id: '3', type: 'full_jar', jar_id: 'j1', created_at: '2026-11-04T07:00:00Z' }),
    ];
    const sections = buildSections(rows, NOW, TZ);
    expect(sections.map((s) => [s.key, s.entries.map((e) => e.ids[0])])).toEqual([
      ['today', ['1']],
      ['week', ['2']],
      ['earlier', ['3']],
    ]);
  });

  it('folds likes on the same jar into one entry with distinct actors, but keeps other jars and moments apart', () => {
    const rows = [
      row({ id: '1', type: 'like', actor: aya, jar_id: 'j1', created_at: '2026-11-12T06:00:00Z' }),
      row({ id: '2', type: 'like', actor: jun, jar_id: 'j1', created_at: '2026-11-12T05:00:00Z', read_at: 'x' }),
      row({ id: '3', type: 'comment', actor: jun, jar_id: 'j1', created_at: '2026-11-12T04:30:00Z' }),
      row({ id: '4', type: 'like', actor: mika, jar_id: 'j1', moment_id: 'mo1', created_at: '2026-11-12T04:00:00Z' }),
      row({ id: '5', type: 'like', actor: mika, jar_id: 'j2', created_at: '2026-11-12T03:00:00Z' }),
    ];
    const [today] = buildSections(rows, NOW, TZ);
    expect(today!.entries.map((e) => [e.type, e.ids])).toEqual([
      ['like', ['1', '2']],
      ['comment', ['3']],
      ['like', ['4']],
      ['like', ['5']],
    ]);
    expect(today!.entries[0]!.actors.map((a) => a.id)).toEqual(['a', 'j']);
    expect(today!.entries[0]!.unread).toBe(true);
  });

  it('drops social rows whose actor RLS hides, but keeps system rows', () => {
    const rows = [
      row({ id: '1', type: 'like', jar_id: 'j1', created_at: '2026-11-12T06:00:00Z' }),
      row({ id: '2', type: 'removed', moment_id: 'mo1', created_at: '2026-11-12T05:00:00Z' }),
    ];
    expect(buildSections(rows, NOW, TZ)[0]!.entries.map((e) => e.ids[0])).toEqual(['2']);
  });
});

describe('targetOf', () => {
  const entry = (r: NotificationRow) => buildSections([r], NOW, TZ)[0]!.entries[0]!;
  const at = '2026-11-12T06:00:00Z';

  it('opens the actor profile for new readers and friends who joined', () => {
    expect(targetOf(entry(row({ id: '1', type: 'new_reader', actor: mika, created_at: at })))).toEqual({
      pathname: '/u/[username]',
      params: { username: 'mika' },
    });
  });

  it('opens the comments of the comment jar, even when only the comment carries the jar', () => {
    const r = row({
      id: '1',
      type: 'reply',
      actor: jun,
      comment_id: 'c1',
      comment: { body: 'hi', jar_id: 'j9' },
      created_at: at,
    });
    expect(targetOf(entry(r))).toEqual({ pathname: '/comments/[jarId]', params: { jarId: 'j9' } });
  });

  it("opens the moment's own thread for a comment or reply on a moment (0068)", () => {
    for (const type of ['comment', 'reply'] as const) {
      const r = row({ id: '1', type, actor: jun, jar_id: 'j9', moment_id: 'mo1', comment_id: 'c1', created_at: at });
      expect(targetOf(entry(r))).toEqual({ pathname: '/comments/[jarId]', params: { jarId: 'j9', momentId: 'mo1' } });
    }
  });

  it('opens the moment for a moment like and the jar for a jar like or full jar', () => {
    expect(
      targetOf(entry(row({ id: '1', type: 'like', actor: aya, jar_id: 'j1', moment_id: 'mo1', created_at: at }))),
    ).toEqual({
      pathname: '/moment/[id]',
      params: { id: 'mo1' },
    });
    expect(targetOf(entry(row({ id: '2', type: 'like', actor: aya, jar_id: 'j1', created_at: at })))).toEqual({
      pathname: '/jar/[id]',
      params: { id: 'j1' },
    });
    expect(targetOf(entry(row({ id: '3', type: 'full_jar', jar_id: 'j1', created_at: at })))).toEqual({
      pathname: '/jar/[id]',
      params: { id: 'j1' },
    });
  });

  it('has nothing to open when the target is gone', () => {
    expect(targetOf(entry(row({ id: '1', type: 'full_jar', created_at: at })))).toBeNull();
  });
});

describe('ageLabel', () => {
  it('uses minutes and hours today, a weekday this week and a date before that', () => {
    expect(ageLabel('2026-11-12T06:48:00Z', NOW, TZ, 'en-US')).toEqual({ kind: 'minutes', count: 12 });
    expect(ageLabel('2026-11-12T05:00:00Z', NOW, TZ, 'en-US')).toEqual({ kind: 'hours', count: 2 });
    expect(ageLabel('2026-11-08T07:00:00Z', NOW, TZ, 'en-US')).toEqual({ kind: 'date', text: 'Sun' });
    expect(ageLabel('2026-11-01T07:00:00Z', NOW, TZ, 'en-US')).toEqual({ kind: 'date', text: 'Nov 1' });
  });
});

describe('pushTarget', () => {
  it("opens what the Notifications row opens: a moment comment opens the moment's thread", () => {
    expect(
      pushTarget({ type: 'comment', notificationIds: ['n1'], jarId: 'j9', momentId: 'mo1', commentId: 'c1' }),
    ).toEqual({
      pathname: '/comments/[jarId]',
      params: { jarId: 'j9', momentId: 'mo1' },
    });
    expect(pushTarget({ type: 'comment', notificationIds: ['n1'], jarId: 'j9', commentId: 'c1' })).toEqual({
      pathname: '/comments/[jarId]',
      params: { jarId: 'j9' },
    });
    expect(pushTarget({ type: 'like', notificationIds: ['n1', 'n2'], jarId: 'j1' })).toEqual({
      pathname: '/jar/[id]',
      params: { id: 'j1' },
    });
  });

  it('falls back to Notifications when the push has no screen of its own, and ignores reminders', () => {
    expect(pushTarget({ type: 'new_reader', notificationIds: ['n1'] })).toEqual({ pathname: '/notifications' });
    expect(pushTarget({ kind: 'reminder', slot: 'morning', localDate: '2026-11-13' })).toBeNull();
    expect(pushTarget(undefined)).toBeNull();
  });
});
