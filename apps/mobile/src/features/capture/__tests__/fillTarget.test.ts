import type { Slot } from '@/theme/tokens';

import { fillCameraSlot, fillTarget, missingSlots, parseFillDateParam } from '../fillTarget';

const TODAY = '2026-11-11';

describe('parseFillDateParam', () => {
  it('accepts a past date, including yesterday and the last day of an earlier month', () => {
    expect(parseFillDateParam('2026-11-08', TODAY)).toBe('2026-11-08');
    expect(parseFillDateParam('2026-11-10', TODAY)).toBe('2026-11-10');
    expect(parseFillDateParam('2026-10-31', TODAY)).toBe('2026-10-31');
    expect(parseFillDateParam(['2026-11-08', '2026-11-01'], TODAY)).toBe('2026-11-08');
  });

  it('refuses today and future dates: those are a normal capture into the open jar', () => {
    expect(parseFillDateParam(TODAY, TODAY)).toBeNull();
    expect(parseFillDateParam('2026-11-12', TODAY)).toBeNull();
    expect(parseFillDateParam('2027-01-01', TODAY)).toBeNull();
  });

  it('refuses anything that is not a real calendar date', () => {
    for (const raw of [
      undefined,
      null,
      '',
      '2026-11-8',
      '2026/11/08',
      '2026-02-30',
      '2026-13-01',
      '2026-11-08T00:00',
      20261108,
    ]) {
      expect(parseFillDateParam(raw, TODAY)).toBeNull();
    }
  });
});

describe('fillTarget', () => {
  it("queues under that date in the jar's own zone, not the phone's", () => {
    expect(fillTarget('2026-11-08', { tz: 'Asia/Manila' }, 'Pacific/Honolulu')).toEqual({
      localDate: '2026-11-08',
      tz: 'Asia/Manila',
    });
  });

  it("uses the phone zone when the day has no jar yet (or it isn't loaded)", () => {
    expect(fillTarget('2026-11-08', null, 'Pacific/Honolulu')).toEqual({
      localDate: '2026-11-08',
      tz: 'Pacific/Honolulu',
    });
    expect(fillTarget('2026-11-08', undefined, 'Asia/Tokyo')).toEqual({ localDate: '2026-11-08', tz: 'Asia/Tokyo' });
  });
});

describe('missing slots and the Fill this jar slot', () => {
  const taken = new Set<Slot>(['whereami', 'morning', 'ootd', 'evening']);

  it('lists only the slots not yet filled, in jar order', () => {
    expect(missingSlots(taken)).toEqual(['mebusywith', 'whoamiwith', 'selfie', 'afternoon']);
  });

  it('opens on the requested slot when it is missing', () => {
    expect(fillCameraSlot({ param: 'selfie', taken })).toBe('selfie');
  });

  it('never opens on a filled slot: a taken or missing param falls to the first missing one', () => {
    expect(fillCameraSlot({ param: 'morning', taken })).toBe('mebusywith');
    expect(fillCameraSlot({ param: null, taken })).toBe('mebusywith');
  });

  it('has nothing to fill in a full jar', () => {
    const full = new Set<Slot>([
      'whereami',
      'mebusywith',
      'whoamiwith',
      'ootd',
      'selfie',
      'morning',
      'afternoon',
      'evening',
    ]);
    expect(missingSlots(full)).toEqual([]);
    expect(fillCameraSlot({ param: 'selfie', taken: full })).toBeNull();
  });
});
