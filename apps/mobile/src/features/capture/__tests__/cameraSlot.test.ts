import { defaultCameraSlot, parseSlotParam, switchSlot } from '../cameraSlot';
import type { Slot } from '@/theme/tokens';

const none = new Set<Slot>();

describe('parseSlotParam', () => {
  it.each(['whereami', 'ootd', 'evening'] as const)('accepts %s', (slot) => {
    expect(parseSlotParam(slot)).toBe(slot);
  });

  it('takes the first of a repeated param', () => {
    expect(parseSlotParam(['morning', 'evening'])).toBe('morning');
  });

  it.each([undefined, '', 'sunrise', 'MORNING', '#morning', 3, null])('refuses %p', (raw) => {
    expect(parseSlotParam(raw)).toBeNull();
  });
});

describe('defaultCameraSlot', () => {
  it('uses the slot param first, even over the current slot', () => {
    expect(defaultCameraSlot({ param: 'ootd', nowSlot: 'afternoon', taken: none })).toBe('ootd');
  });

  it('uses the slot param even if that slot is taken (the tile asked for it)', () => {
    expect(defaultCameraSlot({ param: 'ootd', nowSlot: 'afternoon', taken: new Set(['ootd']) })).toBe('ootd');
  });

  it('falls back to the current time slot', () => {
    expect(defaultCameraSlot({ param: null, nowSlot: 'evening', taken: none })).toBe('evening');
  });

  it('skips a current slot that is already taken and takes the first open slot', () => {
    expect(defaultCameraSlot({ param: null, nowSlot: 'morning', taken: new Set(['morning', 'whereami']) })).toBe(
      'mebusywith',
    );
  });

  it('takes the first open slot in jar order when there is no current slot (00:00–04:59)', () => {
    expect(defaultCameraSlot({ param: null, nowSlot: null, taken: none })).toBe('whereami');
    expect(defaultCameraSlot({ param: null, nowSlot: null, taken: new Set(['whereami', 'mebusywith']) })).toBe(
      'whoamiwith',
    );
  });

  it('keeps the current slot, else the first slot, when the jar is full', () => {
    const all = new Set<Slot>([
      'whereami',
      'mebusywith',
      'whoamiwith',
      'ootd',
      'selfie',
      'morning',
      'afternoon',
      'evening',
    ]);
    expect(defaultCameraSlot({ param: null, nowSlot: 'afternoon', taken: all })).toBe('afternoon');
    expect(defaultCameraSlot({ param: null, nowSlot: null, taken: all })).toBe('whereami');
  });
});

describe('switchSlot', () => {
  it('changes the target to an open slot', () => {
    expect(switchSlot('afternoon', 'selfie', none)).toBe('selfie');
  });

  it('keeps the current slot when the picked one is taken', () => {
    expect(switchSlot('afternoon', 'selfie', new Set(['selfie']))).toBe('afternoon');
  });

  it('allows re-picking the current slot even if it is taken', () => {
    expect(switchSlot('ootd', 'ootd', new Set(['ootd']))).toBe('ootd');
  });
});
