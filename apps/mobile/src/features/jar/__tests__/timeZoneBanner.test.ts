import { shouldShowTimeZoneBanner, zoneChanged, zoneCity, type BannerJar } from '../timeZoneBanner';

const tokyoJar: BannerJar = { id: 'jar-tokyo', tz: 'Asia/Tokyo', localDate: '2026-11-10' };
const none: ReadonlySet<string> = new Set();

describe('shouldShowTimeZoneBanner (FR-JAR-05)', () => {
  it('same zone as the previous jar: no banner', () => {
    expect(
      shouldShowTimeZoneBanner({
        jar: { ...tokyoJar, tz: 'Asia/Manila' },
        previousTz: 'Asia/Manila',
        acknowledged: none,
      }),
    ).toBe(false);
  });

  it('first jar in a new zone: banner', () => {
    expect(shouldShowTimeZoneBanner({ jar: tokyoJar, previousTz: 'Asia/Manila', acknowledged: none })).toBe(true);
  });

  it('after Got it on that jar: no banner', () => {
    expect(
      shouldShowTimeZoneBanner({ jar: tokyoJar, previousTz: 'Asia/Manila', acknowledged: new Set(['jar-tokyo']) }),
    ).toBe(false);
  });

  it('only the acknowledged jar is hidden: a later change to another zone shows it again', () => {
    const acknowledged = new Set(['jar-tokyo']);
    const seoulJar: BannerJar = { id: 'jar-seoul', tz: 'Asia/Seoul', localDate: '2026-11-12' };
    expect(shouldShowTimeZoneBanner({ jar: seoulJar, previousTz: 'Asia/Tokyo', acknowledged })).toBe(true);
    // The next day in Seoul is the same zone again: nothing.
    const seoulNextDay: BannerJar = { id: 'jar-seoul-2', tz: 'Asia/Seoul', localDate: '2026-11-13' };
    expect(shouldShowTimeZoneBanner({ jar: seoulNextDay, previousTz: 'Asia/Seoul', acknowledged })).toBe(false);
  });

  it('no previous jar, unknown previous zone or no jar yet: no banner', () => {
    expect(shouldShowTimeZoneBanner({ jar: tokyoJar, previousTz: null, acknowledged: none })).toBe(false);
    expect(shouldShowTimeZoneBanner({ jar: tokyoJar, previousTz: undefined, acknowledged: none })).toBe(false);
    expect(shouldShowTimeZoneBanner({ jar: null, previousTz: 'Asia/Manila', acknowledged: none })).toBe(false);
  });

  it('refuses offsets and abbreviations (rule 7)', () => {
    for (const bad of ['+08:00', 'GMT+8', 'UTC+08:00', 'PST', 'Etc/GMT-8', 'posix/Asia/Tokyo', 'Not/AZone']) {
      expect(shouldShowTimeZoneBanner({ jar: tokyoJar, previousTz: bad, acknowledged: none })).toBe(false);
      expect(
        shouldShowTimeZoneBanner({ jar: { ...tokyoJar, tz: bad }, previousTz: 'Asia/Manila', acknowledged: none }),
      ).toBe(false);
    }
    expect(zoneChanged('UTC', 'Asia/Manila')).toBe(true);
  });
});

describe('zoneCity', () => {
  it('reads the place from the IANA name', () => {
    expect(zoneCity('Asia/Manila')).toBe('Manila');
    expect(zoneCity('Asia/Tokyo')).toBe('Tokyo');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('America/Port_of_Spain')).toBe('Port of Spain');
    expect(zoneCity('UTC')).toBe('UTC');
  });

  it('never produces an offset', () => {
    for (const bad of ['+08:00', 'GMT+8', 'Etc/GMT-8', 'PST']) expect(() => zoneCity(bad)).toThrow(RangeError);
  });
});
