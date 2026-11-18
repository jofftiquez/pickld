import Image from 'next/image';

import type { Slot } from '@/theme/tokens';

import { momentPhotos } from './momentPhotos';

/** Three example photos for a moment, fanned like playing cards, with its #tag on the front card. Decorative. */
export function MomentFan({ slot }: { slot: Slot }) {
  return (
    <div className="mk-fan" aria-hidden>
      {momentPhotos[slot].map((src, n) => (
        <div key={n} className={`mk-fan-card mk-fan-${n}`}>
          <Image src={src} alt="" sizes="(min-width: 900px) 250px, 40vw" placeholder="blur" />
          {n === 0 ? <span>#{slot}</span> : null}
        </div>
      ))}
    </div>
  );
}
