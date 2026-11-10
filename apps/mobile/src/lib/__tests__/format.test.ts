import { formatShortDate, formatTime } from '../format';

const moment = new Date('2026-11-09T06:48:00Z'); // 2:48 PM in Manila

describe('locale-aware formatting', () => {
  it('formats time in the given zone and locale', () => {
    expect(formatTime(moment, 'Asia/Manila', 'en-US')).toBe('2:48 PM');
    expect(formatTime(moment, 'Europe/London', 'en-GB')).toMatch(/^0?6:48$/);
  });

  it('formats short dates per locale', () => {
    expect(formatShortDate(moment, 'Asia/Manila', 'en-US')).toBe('Mon, Nov 9');
    expect(formatShortDate(moment, 'Asia/Manila', 'fil-PH')).not.toBe('Mon, Nov 9');
  });
});
