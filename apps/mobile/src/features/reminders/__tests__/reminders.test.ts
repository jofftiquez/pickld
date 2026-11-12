import {
  DEFAULT_REMINDERS,
  mergeSettings,
  parseLocalTime,
  planReminders,
  type PlannedReminder,
  REMINDER_ID_PREFIX,
} from '../reminderPlan';
import { syncReminders, type ReminderApi } from '../syncReminders';

jest.mock('expo-notifications', () => ({}));

const MANILA = 'Asia/Manila'; // UTC+8, no DST
// 10:00 in Manila on Thu 2026-11-12: the morning reminder (07:00) has passed, afternoon and evening haven't.
const now = new Date('2026-11-12T02:00:00Z');

const ids = (plan: PlannedReminder[]) => plan.map((r) => r.id.slice(REMINDER_ID_PREFIX.length));

describe('planReminders', () => {
  it('plans 7 days of enabled slots, skipping times already past today', () => {
    const plan = planReminders({ settings: DEFAULT_REMINDERS, tz: MANILA, now, filledToday: new Set() });
    expect(plan).toHaveLength(7 * 3 - 1);
    expect(ids(plan).slice(0, 3)).toEqual(['2026-11-12:afternoon', '2026-11-12:evening', '2026-11-13:morning']);
    expect(plan[0]?.fireAt.toISOString()).toBe('2026-11-12T05:00:00.000Z'); // 13:00 in Manila
    expect(plan[1]?.fireAt.toISOString()).toBe('2026-11-12T11:30:00.000Z'); // 19:30
    expect(ids(plan).at(-1)).toBe('2026-11-18:evening');
  });

  it('filling a slot cancels today’s reminder for it, but not tomorrow’s', () => {
    const plan = planReminders({ settings: DEFAULT_REMINDERS, tz: MANILA, now, filledToday: new Set(['afternoon']) });
    expect(ids(plan)).not.toContain('2026-11-12:afternoon');
    expect(ids(plan)).toContain('2026-11-13:afternoon');
    expect(ids(plan)).toContain('2026-11-12:evening');
  });

  it('leaves out a slot turned off, every day', () => {
    const settings = mergeSettings([{ slot: 'evening', minutes: 19 * 60 + 30, enabled: false }]);
    const plan = planReminders({ settings, tz: MANILA, now, filledToday: new Set() });
    expect(plan.some((r) => r.slot === 'evening')).toBe(false);
  });

  it('follows the phone’s zone: the same settings fire at local times after a trip', () => {
    const plan = planReminders({ settings: DEFAULT_REMINDERS, tz: 'Asia/Tokyo', now, filledToday: new Set() });
    // 11:00 in Tokyo: the next is 13:00 Tokyo = 04:00Z, an hour earlier than Manila's.
    expect(plan[0]?.id).toBe(`${REMINDER_ID_PREFIX}2026-11-12:afternoon`);
    expect(plan[0]?.fireAt.toISOString()).toBe('2026-11-12T04:00:00.000Z');
  });

  it('keeps wall-clock times across a DST change', () => {
    // New York leaves DST on Sun 2026-11-01: 07:00 is 11:00Z before and 12:00Z after.
    const plan = planReminders({
      settings: [{ slot: 'morning', minutes: 7 * 60, enabled: true }],
      tz: 'America/New_York',
      now: new Date('2026-10-30T16:00:00Z'),
      filledToday: new Set(),
    });
    const at = Object.fromEntries(plan.map((r) => [r.localDate, r.fireAt.toISOString()]));
    expect(at['2026-10-31']).toBe('2026-10-31T11:00:00.000Z');
    expect(at['2026-11-02']).toBe('2026-11-02T12:00:00.000Z');
  });

  it('rotates the copy from day to day and never uses one line for every slot of a day', () => {
    const plan = planReminders({ settings: DEFAULT_REMINDERS, tz: MANILA, now, filledToday: new Set() });
    const mornings = plan.filter((r) => r.slot === 'morning').map((r) => r.copy);
    expect(new Set(mornings).size).toBe(4);
    const day = plan.filter((r) => r.localDate === '2026-11-13').map((r) => r.copy);
    expect(new Set(day).size).toBe(3);
  });
});

describe('settings', () => {
  it('reads Postgres times and refuses malformed ones', () => {
    expect(parseLocalTime('07:30:00')).toBe(450);
    expect(parseLocalTime('19:05')).toBe(1145);
    expect(parseLocalTime('24:00')).toBeNull();
    expect(parseLocalTime('7:30')).toBeNull();
  });

  it('a slot without a saved row keeps its default', () => {
    const merged = mergeSettings([{ slot: 'morning', minutes: 6 * 60, enabled: true }]);
    expect(merged.map((s) => [s.slot, s.minutes])).toEqual([
      ['morning', 360],
      ['afternoon', 780],
      ['evening', 1170],
    ]);
  });
});

describe('syncReminders', () => {
  function fakeApi(existing: string[]) {
    const scheduled = new Map<string, Date>(existing.map((id) => [id, new Date(0)]));
    const api: ReminderApi = {
      scheduledIds: () => Promise.resolve([...scheduled.keys()]),
      cancel: (id) => (scheduled.delete(id), Promise.resolve()),
      schedule: (id, _content, at) => (scheduled.set(id, at), Promise.resolve()),
    };
    return { api, scheduled };
  }
  const content = () => ({ title: 't', body: 'b' });

  it('cancels a reminder whose slot was just filled and leaves other notifications alone', async () => {
    const before = planReminders({ settings: DEFAULT_REMINDERS, tz: MANILA, now, filledToday: new Set() });
    const { api, scheduled } = fakeApi([...before.map((r) => r.id), 'something-else']);
    const after = planReminders({ settings: DEFAULT_REMINDERS, tz: MANILA, now, filledToday: new Set(['evening']) });
    await syncReminders(after, content, api);
    expect(scheduled.has(`${REMINDER_ID_PREFIX}2026-11-12:evening`)).toBe(false);
    expect(scheduled.has(`${REMINDER_ID_PREFIX}2026-11-13:evening`)).toBe(true);
    expect(scheduled.has('something-else')).toBe(true);
    expect([...scheduled.keys()].filter((id) => id.startsWith(REMINDER_ID_PREFIX))).toHaveLength(after.length);
  });

  it('moves reminders when a time changes, without duplicates', async () => {
    const { api, scheduled } = fakeApi([]);
    await syncReminders(
      planReminders({ settings: DEFAULT_REMINDERS, tz: MANILA, now, filledToday: new Set() }),
      content,
      api,
    );
    const later = mergeSettings([{ slot: 'evening', minutes: 21 * 60, enabled: true }]);
    await syncReminders(planReminders({ settings: later, tz: MANILA, now, filledToday: new Set() }), content, api);
    expect(scheduled.size).toBe(20);
    expect(scheduled.get(`${REMINDER_ID_PREFIX}2026-11-12:evening`)?.toISOString()).toBe('2026-11-12T13:00:00.000Z');
  });
});
