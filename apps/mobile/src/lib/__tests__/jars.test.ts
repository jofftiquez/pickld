import {
  chooseJar,
  currentSlot,
  findOpenJar,
  isJarOpen,
  jarEndsAt,
  localDateIn,
  normalizeZone,
  serverNow,
  serverOffsetMs,
  type JarRef,
} from '../jars';

// Every expected value below is worked out by hand from the zone's UTC offset on that date
// (2026 rules), not from the code under test.
const at = (iso: string) => new Date(iso);
const jar = (id: string, local_date: string, tz: string, ends_at?: string): JarRef => ({ id, local_date, tz, ends_at });

describe('localDateIn', () => {
  it.each([
    // Manila is UTC+8 all year: midnight Nov 11 local is 16:00Z on Nov 10.
    ['2026-11-10T15:59:59.999Z', 'Asia/Manila', '2026-11-10'],
    ['2026-11-10T16:00:00.000Z', 'Asia/Manila', '2026-11-11'],
    ['2026-11-10T23:59:59.000Z', 'UTC', '2026-11-10'],
    ['2026-11-11T00:00:00.000Z', 'UTC', '2026-11-11'],
    // New York: EST (UTC-5) in winter, so 04:59Z is still the previous evening.
    ['2026-01-01T04:59:00Z', 'America/New_York', '2025-12-31'],
    ['2026-01-01T05:00:00Z', 'America/New_York', '2026-01-01'],
    // Date line at 12:00Z on Nov 10: Kiritimati UTC+14 → Nov 11 02:00; Auckland NZDT UTC+13 → Nov 11
    // 01:00; Pago Pago UTC-11 → Nov 10 01:00. Same instant, two calendar days apart in name.
    ['2026-11-10T12:00:00Z', 'Pacific/Kiritimati', '2026-11-11'],
    ['2026-11-10T12:00:00Z', 'Pacific/Auckland', '2026-11-11'],
    ['2026-11-10T12:00:00Z', 'Pacific/Pago_Pago', '2026-11-10'],
    // Kiritimati at 09:59Z is Nov 10 23:59 and Pago Pago is Nov 9 22:59: a 25-hour gap.
    ['2026-11-10T09:59:00Z', 'Pacific/Kiritimati', '2026-11-10'],
    ['2026-11-10T09:59:00Z', 'Pacific/Pago_Pago', '2026-11-09'],
  ])('%s in %s is %s', (iso, tz, expected) => {
    expect(localDateIn(at(iso), tz)).toBe(expected);
  });

  it.each(['+08:00', 'GMT+8', 'PST', 'PST8PDT', 'posix/Asia/Manila', 'Mars/Olympus'])(
    'refuses non-IANA zone %s',
    (tz) => {
      expect(() => localDateIn(at('2026-11-10T00:00:00Z'), tz)).toThrow(RangeError);
    },
  );
});

describe('currentSlot', () => {
  it.each([
    // Manila UTC+8: local hh:mm on Nov 10 = UTC minus 8 hours.
    ['2026-11-09T16:00:00Z', 'Asia/Manila', null], // 00:00
    ['2026-11-09T20:59:59Z', 'Asia/Manila', null], // 04:59:59
    ['2026-11-09T21:00:00Z', 'Asia/Manila', 'morning'], // 05:00
    ['2026-11-10T03:59:59Z', 'Asia/Manila', 'morning'], // 11:59:59
    ['2026-11-10T04:00:00Z', 'Asia/Manila', 'afternoon'], // 12:00
    ['2026-11-10T09:59:59Z', 'Asia/Manila', 'afternoon'], // 17:59:59
    ['2026-11-10T10:00:00Z', 'Asia/Manila', 'evening'], // 18:00
    ['2026-11-10T15:59:59Z', 'Asia/Manila', 'evening'], // 23:59:59
    ['2026-11-10T16:00:00Z', 'Asia/Manila', null], // 00:00 next day
    // Same instant, different zone: 21:00Z is 05:00 Manila but 21:00 London (GMT in November).
    ['2026-11-09T21:00:00Z', 'Europe/London', 'evening'],
    // New York spring-forward (Mar 8, 02:00 EST → 03:00 EDT): 07:30Z is 03:30 EDT, 08:59Z is
    // 04:59 EDT, 09:00Z is 05:00 EDT. Under EST these would be an hour earlier.
    ['2026-03-08T07:30:00Z', 'America/New_York', null],
    ['2026-03-08T08:59:00Z', 'America/New_York', null],
    ['2026-03-08T09:00:00Z', 'America/New_York', 'morning'],
    // New York fall-back (Nov 1): 09:59Z is 04:59 EST, 10:00Z is 05:00 EST.
    ['2026-11-01T09:59:00Z', 'America/New_York', null],
    ['2026-11-01T10:00:00Z', 'America/New_York', 'morning'],
  ] as const)('%s in %s is %s', (iso, tz, expected) => {
    expect(currentSlot(at(iso), tz)).toBe(expected);
  });
});

describe('jarEndsAt: next local midnight in the jar zone', () => {
  it.each([
    ['2026-11-10', 'Asia/Manila', '2026-11-10T16:00:00.000Z'], // Nov 11 00:00 +08
    ['2026-11-10', 'Asia/Tokyo', '2026-11-10T15:00:00.000Z'], // Nov 11 00:00 +09
    ['2026-11-10', 'Europe/London', '2026-11-11T00:00:00.000Z'], // Nov 11 00:00 GMT
    ['2026-12-31', 'UTC', '2027-01-01T00:00:00.000Z'], // year rollover
    ['2028-02-28', 'UTC', '2028-02-29T00:00:00.000Z'], // leap day
    // New York spring-forward day is 23 hours: Mar 7 ends at 00:00 EST, Mar 8 ends at 00:00 EDT.
    ['2026-03-07', 'America/New_York', '2026-03-08T05:00:00.000Z'],
    ['2026-03-08', 'America/New_York', '2026-03-09T04:00:00.000Z'],
    // New York fall-back day is 25 hours.
    ['2026-10-31', 'America/New_York', '2026-11-01T04:00:00.000Z'],
    ['2026-11-01', 'America/New_York', '2026-11-02T05:00:00.000Z'],
    // London: BST starts Mar 29, ends Oct 25.
    ['2026-03-28', 'Europe/London', '2026-03-29T00:00:00.000Z'],
    ['2026-03-29', 'Europe/London', '2026-03-29T23:00:00.000Z'],
    ['2026-10-24', 'Europe/London', '2026-10-24T23:00:00.000Z'],
    ['2026-10-25', 'Europe/London', '2026-10-26T00:00:00.000Z'],
    // Santiago skips midnight (Sep 6 00:00 -04 → 01:00 -03). Like Postgres, the skipped midnight uses
    // the offset before the change: 00:00 -04 = 04:00Z, the instant the day really starts.
    ['2026-09-05', 'America/Santiago', '2026-09-06T04:00:00.000Z'],
    // Date line: Kiritimati (+14) and Pago Pago (-11) jars for the same date end 25 hours apart.
    ['2026-11-10', 'Pacific/Kiritimati', '2026-11-10T10:00:00.000Z'],
    ['2026-11-10', 'Pacific/Pago_Pago', '2026-11-11T11:00:00.000Z'],
    ['2026-11-10', 'Pacific/Auckland', '2026-11-10T11:00:00.000Z'], // NZDT +13
  ])('%s in %s ends at %s', (localDate, tz, expected) => {
    expect(jarEndsAt({ local_date: localDate, tz }).toISOString()).toBe(expected);
  });

  it('prefers the server ends_at when present (D-1)', () => {
    const rezoned = jar('a', '2026-11-10', 'Europe/London', '2026-11-11T00:00:00Z');
    expect(jarEndsAt({ ...rezoned, tz: 'Asia/Manila' }).toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });

  it('refuses malformed dates', () => {
    expect(() => jarEndsAt({ local_date: '2026-02-30', tz: 'UTC' })).toThrow(RangeError);
    expect(() => jarEndsAt({ local_date: '11/10/2026', tz: 'UTC' })).toThrow(RangeError);
  });
});

describe('isJarOpen and findOpenJar', () => {
  const manila = jar('manila', '2026-11-10', 'Asia/Manila'); // ends 16:00Z Nov 10

  it.each([
    ['2026-11-10T15:59:59.999Z', true],
    ['2026-11-10T16:00:00.000Z', false],
  ])('a Manila jar at %s open=%s, wherever the phone is', (iso, open) => {
    expect(isJarOpen(manila, at(iso))).toBe(open);
  });

  it('finds the open jar, latest date first', () => {
    const older = jar('older', '2026-11-09', 'Asia/Manila');
    const later = jar('later', '2026-11-10', 'Asia/Manila', '2026-11-11T00:00:00Z');
    expect(findOpenJar([older, manila], at('2026-11-10T12:00:00Z'))?.id).toBe('manila');
    expect(findOpenJar([older, manila], at('2026-11-10T17:00:00Z'))).toBeNull();
    expect(findOpenJar([later, older], at('2026-11-10T17:00:00Z'))?.id).toBe('later');
    expect(findOpenJar([], at('2026-11-10T12:00:00Z'))).toBeNull();
  });
});

describe('chooseJar', () => {
  const manila = jar('manila', '2026-11-10', 'Asia/Manila'); // ends 16:00Z Nov 10

  it('first jar ever: create today in the phone zone, no banner', () => {
    expect(chooseJar({ jars: [], phoneTz: 'Asia/Manila', now: at('2026-11-10T01:00:00Z') })).toEqual({
      action: 'create',
      localDate: '2026-11-10',
      tz: 'Asia/Manila',
      zoneChanged: false,
    });
  });

  it('midnight at home: the next jar is a new date in the same zone, no banner', () => {
    expect(chooseJar({ jars: [manila], phoneTz: 'Asia/Manila', now: at('2026-11-10T15:59:59Z') })).toEqual({
      action: 'use',
      jar: manila,
    });
    expect(chooseJar({ jars: [manila], phoneTz: 'Asia/Manila', now: at('2026-11-10T16:00:00Z') })).toEqual({
      action: 'create',
      localDate: '2026-11-11',
      tz: 'Asia/Manila',
      zoneChanged: false,
    });
  });

  describe('Manila → Tokyo (eastward)', () => {
    // Tokyo midnight Nov 11 is 15:00Z; the Manila jar ends at 16:00Z.
    it('the open Manila jar keeps its hour even though Tokyo shows Nov 11', () => {
      expect(chooseJar({ jars: [manila], phoneTz: 'Asia/Tokyo', now: at('2026-11-10T15:30:00Z') })).toEqual({
        action: 'use',
        jar: manila,
      });
    });
    it('then Nov 11 is created in Tokyo with the banner', () => {
      expect(chooseJar({ jars: [manila], phoneTz: 'Asia/Tokyo', now: at('2026-11-10T16:00:00Z') })).toEqual({
        action: 'create',
        localDate: '2026-11-11',
        tz: 'Asia/Tokyo',
        zoneChanged: true,
      });
    });
  });

  describe('Manila → London (westward collision, D-1)', () => {
    // The Manila jar ends 16:00Z Nov 10, which is 16:00 Nov 10 in London (GMT).
    it('the Manila jar stays open until Manila midnight', () => {
      expect(chooseJar({ jars: [manila], phoneTz: 'Europe/London', now: at('2026-11-10T15:00:00Z') })).toEqual({
        action: 'use',
        jar: manila,
      });
    });
    it('after it ends, London is still Nov 10: re-zone the same-date jar to London midnight', () => {
      expect(chooseJar({ jars: [manila], phoneTz: 'Europe/London', now: at('2026-11-10T17:00:00Z') })).toEqual({
        action: 'rezone',
        jar: manila,
        tz: 'Europe/London',
        endsAt: at('2026-11-11T00:00:00Z'),
      });
    });
    it('once the server re-zoned it, the jar is simply open', () => {
      const rezoned = jar('manila', '2026-11-10', 'Europe/London', '2026-11-11T00:00:00Z');
      expect(chooseJar({ jars: [rezoned], phoneTz: 'Europe/London', now: at('2026-11-10T17:00:00Z') })).toEqual({
        action: 'use',
        jar: rezoned,
      });
    });
    it('a second westward hop extends an already-moved ends_at to the new zone midnight', () => {
      // The Nov 10 jar was already moved to 04:30Z Nov 11. At 04:45Z the phone in New York reads
      // Nov 10 23:45 EST; New York midnight is 05:00Z Nov 11.
      const london = jar('london', '2026-11-10', 'Europe/London', '2026-11-11T04:30:00Z');
      expect(chooseJar({ jars: [london], phoneTz: 'America/New_York', now: at('2026-11-11T04:45:00Z') })).toEqual({
        action: 'rezone',
        jar: london,
        tz: 'America/New_York',
        endsAt: at('2026-11-11T05:00:00Z'),
      });
    });
  });

  describe('date line', () => {
    // A Kiritimati (+14) jar for Nov 10 ends 10:00Z Nov 10; in Pago Pago (-11) that is Nov 9 23:00.
    const kiritimati = jar('kir', '2026-11-10', 'Pacific/Kiritimati');
    it('flying east across the line, the next local date is the one already used: Nov 10 re-zones', () => {
      // 11:00Z Nov 10 is Nov 10 00:00 in Pago Pago.
      expect(chooseJar({ jars: [kiritimati], phoneTz: 'Pacific/Pago_Pago', now: at('2026-11-10T11:00:00Z') })).toEqual({
        action: 'rezone',
        jar: kiritimati,
        tz: 'Pacific/Pago_Pago',
        endsAt: at('2026-11-11T11:00:00Z'),
      });
    });
    it('Pago Pago → Auckland skips a calendar day and creates Nov 12 with the banner', () => {
      const pago = jar('pago', '2026-11-10', 'Pacific/Pago_Pago'); // ends 11:00Z Nov 11
      // 11:30Z Nov 11 is Nov 12 00:30 NZDT.
      expect(chooseJar({ jars: [pago], phoneTz: 'Pacific/Auckland', now: at('2026-11-11T11:30:00Z') })).toEqual({
        action: 'create',
        localDate: '2026-11-12',
        tz: 'Pacific/Auckland',
        zoneChanged: true,
      });
    });
  });

  describe('past dates (gallery photo, Fill this jar)', () => {
    const nov8 = jar('nov8', '2026-11-08', 'Asia/Manila');
    const now = at('2026-11-10T04:00:00Z'); // Nov 10 noon in Manila

    it('use the existing jar for that date', () => {
      expect(chooseJar({ jars: [nov8, manila], phoneTz: 'Asia/Manila', now, targetDate: '2026-11-08' })).toEqual({
        action: 'use',
        jar: nov8,
      });
    });
    it('create a jar for that date when there is none, without the banner', () => {
      expect(chooseJar({ jars: [manila], phoneTz: 'Europe/London', now, targetDate: '2026-11-09' })).toEqual({
        action: 'create',
        localDate: '2026-11-09',
        tz: 'Europe/London',
        zoneChanged: false,
      });
    });
    it("today's or a later date goes to the current jar", () => {
      expect(chooseJar({ jars: [manila], phoneTz: 'Asia/Manila', now, targetDate: '2026-11-10' })).toEqual({
        action: 'use',
        jar: manila,
      });
      expect(chooseJar({ jars: [manila], phoneTz: 'Asia/Tokyo', now, targetDate: '2026-11-11' })).toEqual({
        action: 'use',
        jar: manila,
      });
    });
    it('refuses a malformed target date', () => {
      expect(() => chooseJar({ jars: [], phoneTz: 'Asia/Manila', now, targetDate: '2026-13-01' })).toThrow(RangeError);
    });
  });
});

describe('server time offset', () => {
  it.each([
    ['2026-11-11T00:00:10Z', '2026-11-11T00:00:00Z', 0, 10_000], // phone 10 s slow
    ['2026-11-10T23:55:00Z', '2026-11-11T00:00:00Z', 0, -300_000], // phone 5 min fast
    ['2026-11-11T00:00:10Z', '2026-11-11T00:00:00Z', 400, 10_200], // half the round trip added
    ['Wed, 11 Nov 2026 00:00:10 GMT', '2026-11-11T00:00:00Z', 0, 10_000], // HTTP Date header
  ])('server %s received at %s (rtt %d) → %d ms', (server, received, rtt, expected) => {
    expect(serverOffsetMs(server, at(received), rtt)).toBe(expected);
  });

  it('applies the offset to the device clock', () => {
    expect(serverNow(-300_000, at('2026-11-11T00:00:00Z')).toISOString()).toBe('2026-11-10T23:55:00.000Z');
  });

  it('refuses an unreadable server time', () => {
    expect(() => serverOffsetMs('not a date', at('2026-11-11T00:00:00Z'))).toThrow(RangeError);
  });
});

describe('normalizeZone', () => {
  it.each([
    ['GMT', 'UTC'],
    ['Etc/UTC', 'UTC'],
    ['Etc/GMT', 'UTC'],
    ['UTC', 'UTC'],
    [undefined, 'UTC'],
    ['', 'UTC'],
    ['PST', 'UTC'],
    ['Not/AZone', 'UTC'],
    ['Asia/Manila', 'Asia/Manila'],
    ['America/Argentina/Buenos_Aires', 'America/Argentina/Buenos_Aires'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeZone(raw)).toBe(expected);
  });

  it('gives a zone the jar logic accepts', () => {
    expect(() => localDateIn(new Date('2026-11-11T05:00:00Z'), normalizeZone('GMT'))).not.toThrow();
  });
});
