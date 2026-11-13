// The Share jar card (FR-SOC-10, FR-PUB-05; design: ShareCard). What the 9:16 image shows is decided here,
// so the rule lives in one tested place: only live moments that aren't Only me, even when the owner shares
// their own jar (rule 9: Only me moments never leave their owner, not even on a card they post themselves).
// The count and the caption come from those moments only, so the card can't hint that a private one exists.
// The jar's cover goes first (D-56), so it fills the large cell of the "one large" layouts and the blurred
// background; an Only me pick never does, and the card falls back to the cover rule over its own moments.
import { newestCaptioned, type JarMoment, type JarPageData } from '@/features/jar/jarPage';
import { profileUrl } from '@/lib/links';
import { slots } from '@/theme/tokens';

export type ShareCard = {
  /** Moments on the card (at most 8): the cover first, then slot order. */
  moments: JarMoment[];
  /** The newest caption among those moments, or null when captions are off or there is none. */
  caption: string | null;
  /** "pickld.me/dale", printed on the card. */
  link: string;
  /** "https://pickld.me/dale" */
  profileUrl: string;
};

/** Whether a moment may go on a card: live and not Only me (D-48). An Only me moment can't be shared. */
export function onCard(moment: Pick<JarMoment, 'status' | 'visibility'>): boolean {
  return moment.status === 'live' && moment.visibility !== 'only_me';
}

/**
 * `coverId` is the jar page's resolved cover (0069 `resolved_cover_id`). When it isn't on the card (Only me,
 * or not given), the card's cover is the newest caption among its moments, else the first slot.
 */
export function buildShareCard(
  data: Pick<JarPageData, 'author' | 'moments'> & { coverId?: string | null },
  options: { includeCaption: boolean },
): ShareCard {
  const inSlotOrder = data.moments
    .filter(onCard)
    .sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot))
    .slice(0, slots.length);
  const cover =
    inSlotOrder.find((m) => m.id === data.coverId) ?? newestCaptioned(inSlotOrder) ?? inSlotOrder[0] ?? null;
  const moments = cover ? [cover, ...inSlotOrder.filter((m) => m !== cover)] : inSlotOrder;
  const caption = options.includeCaption ? (newestCaptioned(moments)?.caption?.trim() ?? null) : null;
  const url = profileUrl(data.author.username);
  return { moments, caption, link: url.replace(/^https:\/\//, ''), profileUrl: url };
}
