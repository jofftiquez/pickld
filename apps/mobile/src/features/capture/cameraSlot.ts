// Which moment the camera adds to (FR-CAP-01). Pure: the caller passes the current slot and the
// slots already taken in the open jar (server moments and queued photos).
import { z } from 'zod';

import { slots, type Slot } from '@/theme/tokens';

const slotParam = z.enum(slots);

/** The `?slot=` route param as a slot, or null when missing or not a slot (deep links are untrusted). */
export function parseSlotParam(raw: unknown): Slot | null {
  const value = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  const parsed = slotParam.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The slot the camera opens on:
 * 1. the `slot` param (a tile on Today, or Fill this jar), even if taken;
 * 2. else the current time slot (morning, afternoon, evening) while it is still open;
 * 3. else the first open slot in jar order;
 * 4. else (a full jar) the current slot, or the first slot.
 */
export function defaultCameraSlot(input: { param: Slot | null; nowSlot: Slot | null; taken: ReadonlySet<Slot> }): Slot {
  const { param, nowSlot, taken } = input;
  if (param) return param;
  if (nowSlot && !taken.has(nowSlot)) return nowSlot;
  return slots.find((slot) => !taken.has(slot)) ?? nowSlot ?? slots[0];
}

/** The slot switcher: picking a taken slot keeps the current one (replacing a moment is M2-22). */
export function switchSlot(current: Slot, next: Slot, taken: ReadonlySet<Slot>): Slot {
  return taken.has(next) && next !== current ? current : next;
}
