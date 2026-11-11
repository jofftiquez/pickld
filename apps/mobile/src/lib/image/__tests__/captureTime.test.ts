import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chooseJar } from '../../jars';
import { captureInfo } from '../captureTime';
import { readImageMetadata } from '../exif';

const fixture = (name: string) =>
  readImageMetadata(new Uint8Array(readFileSync(join(__dirname, '__fixtures__', name))));
const NOW = new Date('2026-11-11T05:00:00Z'); // 13:00 in Manila, 2026-11-10 21:00 in Los Angeles

describe('captureInfo', () => {
  it.each([
    // [label, exif, phoneTz, now, capturedAt, localDate, source]
    [
      'offset: photo-local date',
      { DateTimeOriginal: '2026:11:09 23:45:10', OffsetTimeOriginal: '+08:00' },
      'Asia/Manila',
      NOW,
      '2026-11-09T23:45:10+08:00',
      '2026-11-09',
      'exif-offset',
    ],
    [
      'offset wins over a different phone zone',
      { DateTimeOriginal: '2026:11:09 23:45:10', OffsetTimeOriginal: '+08:00' },
      'America/Los_Angeles',
      NOW,
      '2026-11-09T23:45:10+08:00',
      '2026-11-09',
      'exif-offset',
    ],
    [
      'offset: one second before midnight',
      { DateTimeOriginal: '2026:11:09 23:59:59', OffsetTimeOriginal: '-05:00' },
      'Asia/Manila',
      NOW,
      '2026-11-09T23:59:59-05:00',
      '2026-11-09',
      'exif-offset',
    ],
    [
      'offset: midnight starts the next date',
      { DateTimeOriginal: '2026:11:10 00:00:00', OffsetTimeOriginal: '-05:00' },
      'Asia/Manila',
      NOW,
      '2026-11-10T00:00:00-05:00',
      '2026-11-10',
      'exif-offset',
    ],
    [
      'half-hour negative offset',
      { DateTimeOriginal: '2026:11:08 10:00:00', OffsetTimeOriginal: '-03:30' },
      'Asia/Manila',
      NOW,
      '2026-11-08T10:00:00-03:30',
      '2026-11-08',
      'exif-offset',
    ],
    [
      'no offset: phone zone, before midnight',
      { DateTimeOriginal: '2026:11:09 23:59:59' },
      'Asia/Manila',
      NOW,
      '2026-11-09T23:59:59+08:00',
      '2026-11-09',
      'exif-phone-zone',
    ],
    [
      'no offset: phone zone, at midnight',
      { DateTimeOriginal: '2026:11:10 00:00:00' },
      'Asia/Manila',
      NOW,
      '2026-11-10T00:00:00+08:00',
      '2026-11-10',
      'exif-phone-zone',
    ],
    [
      'blank offset is ignored',
      { DateTimeOriginal: '2026:11:10 00:00:00', OffsetTimeOriginal: '   :  ' },
      'Asia/Manila',
      NOW,
      '2026-11-10T00:00:00+08:00',
      '2026-11-10',
      'exif-phone-zone',
    ],
    [
      'no offset: DST gap shifts forward',
      { DateTimeOriginal: '2026:03:08 02:30:00' },
      'America/New_York',
      NOW,
      '2026-03-08T03:30:00-04:00',
      '2026-03-08',
      'exif-phone-zone',
    ],
    [
      'no offset: repeated hour takes the first',
      { DateTimeOriginal: '2026:11:01 01:30:00' },
      'America/New_York',
      NOW,
      '2026-11-01T01:30:00-04:00',
      '2026-11-01',
      'exif-phone-zone',
    ],
    ['missing EXIF → now', {}, 'Asia/Manila', NOW, '2026-11-11T13:00:00+08:00', '2026-11-11', 'now'],
    [
      'missing EXIF → now, phone zone date',
      undefined,
      'America/Los_Angeles',
      NOW,
      '2026-11-10T21:00:00-08:00',
      '2026-11-10',
      'now',
    ],
    [
      'all-zero EXIF date → now',
      { DateTimeOriginal: '0000:00:00 00:00:00' },
      'Asia/Manila',
      NOW,
      '2026-11-11T13:00:00+08:00',
      '2026-11-11',
      'now',
    ],
    [
      'impossible date → now',
      { DateTimeOriginal: '2026:02:30 10:00:00' },
      'Asia/Manila',
      NOW,
      '2026-11-11T13:00:00+08:00',
      '2026-11-11',
      'now',
    ],
    [
      'future EXIF (wrong camera clock) → now',
      { DateTimeOriginal: '2026:11:11 13:00:01', OffsetTimeOriginal: '+08:00' },
      'Asia/Manila',
      NOW,
      '2026-11-11T13:00:00+08:00',
      '2026-11-11',
      'now',
    ],
    [
      'non-string fields → now',
      { DateTimeOriginal: 20261109 },
      'Asia/Manila',
      NOW,
      '2026-11-11T13:00:00+08:00',
      '2026-11-11',
      'now',
    ],
    ['non-object EXIF → now', 'nope', 'Asia/Manila', NOW, '2026-11-11T13:00:00+08:00', '2026-11-11', 'now'],
  ])('%s', (_label, exif, tz, now, capturedAt, localDate, source) => {
    expect(captureInfo(exif, tz, now)).toEqual({ capturedAt, localDate, source });
  });

  it('reads the fixture files', () => {
    expect(captureInfo(fixture('gps-offset.jpg'), 'America/Los_Angeles', NOW)).toEqual({
      capturedAt: '2026-11-09T23:45:10+08:00',
      localDate: '2026-11-09',
      source: 'exif-offset',
    });
    expect(captureInfo(fixture('gps-no-offset.jpg'), 'Asia/Manila', NOW).localDate).toBe('2026-11-10');
    expect(captureInfo(fixture('gps-no-date.jpg'), 'Asia/Manila', NOW).source).toBe('now');
  });

  it('refuses offsets as the phone zone (rule 7)', () => {
    expect(() => captureInfo({}, '+08:00', NOW)).toThrow(RangeError);
  });
});

describe('target jar (acceptance: a past-date photo targets that date’s jar)', () => {
  const jars = [
    { id: 'j9', local_date: '2026-11-09', tz: 'Asia/Manila' },
    { id: 'j11', local_date: '2026-11-11', tz: 'Asia/Manila' },
  ];

  it('a photo from an earlier day goes to that day’s jar', () => {
    const { localDate } = captureInfo(fixture('gps-offset.jpg'), 'Asia/Manila', NOW);
    expect(chooseJar({ jars, phoneTz: 'Asia/Manila', now: NOW, targetDate: localDate })).toEqual({
      action: 'use',
      jar: jars[0],
    });
  });

  it('a past day without a jar creates that date’s jar', () => {
    const { localDate } = captureInfo(fixture('gps-no-offset.jpg'), 'Asia/Manila', NOW);
    expect(chooseJar({ jars, phoneTz: 'Asia/Manila', now: NOW, targetDate: localDate })).toEqual({
      action: 'create',
      localDate: '2026-11-10',
      tz: 'Asia/Manila',
      zoneChanged: false,
    });
  });

  it('a photo without EXIF joins today’s open jar', () => {
    const { localDate } = captureInfo({}, 'Asia/Manila', NOW);
    expect(chooseJar({ jars, phoneTz: 'Asia/Manila', now: NOW, targetDate: localDate })).toEqual({
      action: 'use',
      jar: jars[1],
    });
  });
});
