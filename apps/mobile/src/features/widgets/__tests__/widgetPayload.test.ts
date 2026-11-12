import { friendCaption, nextSlot, todayTimeline, type WidgetStrings } from '../widgetPayload';

const tz = 'Asia/Manila'; // UTC+8, no daylight saving
const strings: WidgetStrings = {
  title: 'Pickld · Today',
  moments: (count, total) => `${count} of ${total} moments`,
  nextUp: (tag) => `Next up: ${tag}`,
  full: 'Jar full',
  captureLabel: 'Capture',
};
// 14:10 in Manila is 06:10 UTC.
const afternoon = new Date('2026-11-12T06:10:00Z');

describe('nextSlot', () => {
  it('picks the current time slot while it is empty, even when earlier slots are empty', () => {
    expect(nextSlot(new Set(['whereami', 'morning']), afternoon, tz)).toBe('afternoon');
  });

  it('falls back to the first empty slot in jar order once the current slot is filled', () => {
    expect(nextSlot(new Set(['whereami', 'afternoon']), afternoon, tz)).toBe('mebusywith');
  });

  it('is null when the jar is full', () => {
    const all = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'] as const;
    expect(nextSlot(new Set(all), afternoon, tz)).toBeNull();
  });
});

describe('todayTimeline', () => {
  const entries = todayTimeline(['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie'], afternoon, tz, strings);
  // Manila midnight on the 13th is 16:00 UTC on the 12th.
  const midnight = new Date('2026-11-12T16:00:00Z').getTime();

  it('steps every 30 minutes until local midnight', () => {
    const before = entries.filter((e) => e.date.getTime() < midnight);
    // 14:10 … 23:40 is 20 entries.
    expect(before).toHaveLength(20);
    expect(before[0]?.props).toMatchObject({ headline: '5 of 8 moments', subline: 'Next up: #afternoon', fill: 5 / 8 });
    // At 18:10 the evening slot is current.
    expect(before[8]?.props.subline).toBe('Next up: #evening');
  });

  it('shows an empty jar from midnight on', () => {
    const after = entries.filter((e) => e.date.getTime() >= midnight);
    expect(after[0]?.date.getTime()).toBe(midnight);
    expect(after[0]?.props).toMatchObject({ headline: '0 of 8 moments', subline: 'Next up: #whereami', fill: 0 });
  });
});

it('captions a friend moment with their first name and the slot tag', () => {
  expect(friendCaption('Mika Santos', 'whoamiwith')).toBe('Mika · #whoamiwith');
});
