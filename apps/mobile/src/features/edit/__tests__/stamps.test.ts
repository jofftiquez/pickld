import { stampText } from '../stickers/stamps';

// Auto stamps (FR-STK-01) show the moment's own capture time in its jar's IANA zone, not the phone's.

// 06:14 UTC on Wednesday 11 November is 2:14 PM in Manila and 1:14 AM in New York.
const capturedAt = new Date('2026-11-11T06:14:00.000Z');
const manila = { capturedAt, tz: 'Asia/Manila' };

describe('stampText', () => {
  it('writes the time, date and weekday like the art, in the jar zone', () => {
    expect(stampText('time', manila, 'en-US')).toBe('2:14 PM');
    expect(stampText('date', manila, 'en-US')).toBe('NOV 11');
    expect(stampText('weekday', manila, 'en-US')).toBe('WEDNESDAY');
  });

  it('follows the jar zone across midnight', () => {
    // 23:30 UTC on Nov 10 is already Wednesday 7:30 AM in Manila.
    const late = { capturedAt: new Date('2026-11-10T23:30:00.000Z'), tz: 'Asia/Manila' };
    expect(stampText('date', late, 'en-US')).toBe('NOV 11');
    expect(stampText('weekday', late, 'en-US')).toBe('WEDNESDAY');
    const ny = { capturedAt, tz: 'America/New_York' };
    expect(stampText('time', ny, 'en-US')).toBe('1:14 AM');
    expect(stampText('weekday', ny, 'en-US')).toBe('WEDNESDAY');
  });

  it('uses the phone locale for the words', () => {
    expect(stampText('weekday', manila, 'fil-PH')).toBe('MIYERKULES');
  });

  it('has no live value for the jar number yet (its art shows)', () => {
    expect(stampText('jar_number', manila, 'en-US')).toBeNull();
  });
});
