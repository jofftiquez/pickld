// Example photos for the home page's fanned moment cards: three per moment, front card first. All are CC0 stock
// photos from StockSnap (stocksnap.io, found through Openverse): free for commercial use, no attribution needed.
// Each was cropped to 3:4 at 600×800 with its metadata stripped (AGENTS rule 5). StockSnap photo IDs, in order:
//   whereami: GO8WSAD6EJ, 0M1SPKYTR4, 61B123B403
//   mebusywith: HHZ5NPNR1T, DB8D7GBTJH, GZU9QAWCE5
//   whoamiwith: 824XB7BXYU, IUQLNUTEMA, LXCMDRFA51
//   ootd: C0H66Y2OKW, 9T31CK3QQS, TEFSYENORD
//   selfie: W8I8JNL7W5, ANXZKJDWFO, SCWWXW9P9E
//   morning: MK3VLNK8NA, CD2134E2DD, JMR76BK6PG
//   afternoon: HGO20PXZVV, 3SEGDBCEQF, A2E33C32B9
//   evening: AMXMQQWNQJ, ZPMWWMHBDE, M0YZ9Q79DZ
import type { StaticImageData } from 'next/image';

import type { Slot } from '@/theme/tokens';

import whereami_1 from './moments/whereami-1.jpg';
import whereami_2 from './moments/whereami-2.jpg';
import whereami_3 from './moments/whereami-3.jpg';
import mebusywith_1 from './moments/mebusywith-1.jpg';
import mebusywith_2 from './moments/mebusywith-2.jpg';
import mebusywith_3 from './moments/mebusywith-3.jpg';
import whoamiwith_1 from './moments/whoamiwith-1.jpg';
import whoamiwith_2 from './moments/whoamiwith-2.jpg';
import whoamiwith_3 from './moments/whoamiwith-3.jpg';
import ootd_1 from './moments/ootd-1.jpg';
import ootd_2 from './moments/ootd-2.jpg';
import ootd_3 from './moments/ootd-3.jpg';
import selfie_1 from './moments/selfie-1.jpg';
import selfie_2 from './moments/selfie-2.jpg';
import selfie_3 from './moments/selfie-3.jpg';
import morning_1 from './moments/morning-1.jpg';
import morning_2 from './moments/morning-2.jpg';
import morning_3 from './moments/morning-3.jpg';
import afternoon_1 from './moments/afternoon-1.jpg';
import afternoon_2 from './moments/afternoon-2.jpg';
import afternoon_3 from './moments/afternoon-3.jpg';
import evening_1 from './moments/evening-1.jpg';
import evening_2 from './moments/evening-2.jpg';
import evening_3 from './moments/evening-3.jpg';

export const momentPhotos: Record<Slot, readonly [StaticImageData, StaticImageData, StaticImageData]> = {
  whereami: [whereami_1, whereami_2, whereami_3],
  mebusywith: [mebusywith_1, mebusywith_2, mebusywith_3],
  whoamiwith: [whoamiwith_1, whoamiwith_2, whoamiwith_3],
  ootd: [ootd_1, ootd_2, ootd_3],
  selfie: [selfie_1, selfie_2, selfie_3],
  morning: [morning_1, morning_2, morning_3],
  afternoon: [afternoon_1, afternoon_2, afternoon_3],
  evening: [evening_1, evening_2, evening_3],
};
