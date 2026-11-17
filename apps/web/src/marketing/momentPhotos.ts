// Example photos for the home page's fanned moment cards: three per moment, front card first. These are
// the design handoff's placeholder photos (repo-root design/images), reused across moments until real
// example photos replace them; swap the imports here and nothing else changes.
import type { StaticImageData } from 'next/image';

import type { Slot } from '@/theme/tokens';

import afternoon from '../../../../design/images/afternoon.jpg';
import busy from '../../../../design/images/busy.jpg';
import evening from '../../../../design/images/evening.jpg';
import food from '../../../../design/images/food.jpg';
import morning from '../../../../design/images/morning.jpg';
import ootd from '../../../../design/images/ootd.jpg';
import selfie from '../../../../design/images/selfie.jpg';
import whereami from '../../../../design/images/whereami.jpg';
import whoamiwith from '../../../../design/images/whoamiwith.jpg';

export const momentPhotos: Record<Slot, readonly [StaticImageData, StaticImageData, StaticImageData]> = {
  whereami: [whereami, afternoon, evening],
  mebusywith: [busy, food, morning],
  whoamiwith: [whoamiwith, whereami, selfie],
  ootd: [ootd, selfie, whereami],
  selfie: [selfie, ootd, whoamiwith],
  morning: [morning, food, whereami],
  afternoon: [afternoon, food, busy],
  evening: [evening, afternoon, food],
};
