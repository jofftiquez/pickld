// The Share jar card (FR-SOC-10, FR-PUB-05; design: ShareCard). What the 9:16 image shows is decided here,
// so the rule lives in one tested place: only live, non-private moments, even when the owner shares their
// own jar (rule 9: private moments never leave their owner, not even on a card they post themselves). The
// count and the caption come from those moments only, so the card can't hint that a private one exists.
import { newestCaptioned, type JarMoment, type JarPageData } from '@/features/jar/jarPage';
import { profileUrl } from '@/lib/links';
import { slots } from '@/theme/tokens';

export type ShareCard = {
  /** Moments on the card, in slot order (at most 8). */
  moments: JarMoment[];
  /** The newest caption among those moments, or null when captions are off or there is none. */
  caption: string | null;
  /** "pickld.me/dale", printed on the card. */
  link: string;
  /** "https://pickld.me/dale" */
  profileUrl: string;
};

export function onCard(moment: Pick<JarMoment, 'status' | 'is_private'>): boolean {
  return moment.status === 'live' && !moment.is_private;
}

export function buildShareCard(
  data: Pick<JarPageData, 'author' | 'moments'>,
  options: { includeCaption: boolean },
): ShareCard {
  const moments = data.moments
    .filter(onCard)
    .sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot))
    .slice(0, slots.length);
  const caption = options.includeCaption ? (newestCaptioned(moments)?.caption?.trim() ?? null) : null;
  const url = profileUrl(data.author.username);
  return { moments, caption, link: url.replace(/^https:\/\//, ''), profileUrl: url };
}
