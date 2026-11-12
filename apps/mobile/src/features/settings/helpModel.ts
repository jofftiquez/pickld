// Help & feedback (M4-17; FR-SET-02). Pure: the FAQ search and the mailto links. The app version and
// platform go into the email body so support knows which build someone is on.
import { SUPPORT_EMAIL } from '@/lib/links';

export type Faq = { q: string; a: string };

/** Accents and case ignored, so \"added later\" finds “Added later”. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Questions whose question or answer contains every word of the query. An empty query keeps them all. */
export function searchFaq(faq: readonly Faq[], query: string): Faq[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...faq];
  return faq.filter((f) => {
    const text = fold(`${f.q} ${f.a}`);
    return words.every((w) => text.includes(w));
  });
}

export function mailtoUrl(subject: string, body: string, to = SUPPORT_EMAIL): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
