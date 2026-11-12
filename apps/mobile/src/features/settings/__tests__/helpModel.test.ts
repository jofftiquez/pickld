import { mailtoUrl, searchFaq } from '../helpModel';

const faq = [
  { q: 'How do jars and moments work?', a: 'Eight slots a day.' },
  { q: 'Why does a moment say “Added later”?', a: 'Filled after its day ended.' },
  { q: 'What happens when I travel?', a: 'The next jar follows the new time zone.' },
];

describe('searchFaq', () => {
  it('keeps everything for an empty query', () => {
    expect(searchFaq(faq, '   ')).toEqual(faq);
  });
  it('matches every word, in the question or the answer, ignoring case', () => {
    expect(searchFaq(faq, 'ADDED later').map((f) => f.q)).toEqual([faq[1]!.q]);
    expect(searchFaq(faq, 'time zone').map((f) => f.q)).toEqual([faq[2]!.q]);
    expect(searchFaq(faq, 'jar').map((f) => f.q)).toEqual([faq[0]!.q, faq[2]!.q]);
  });
  it('needs all the words, not any', () => {
    expect(searchFaq(faq, 'travel slots')).toEqual([]);
  });
  it('ignores accents', () => {
    expect(searchFaq([{ q: 'Café hours?', a: '' }], 'cafe')).toHaveLength(1);
  });
});

describe('mailtoUrl', () => {
  it('encodes the subject and a body carrying the app version', () => {
    const url = mailtoUrl('Pickld feedback', '\n\n—\nPickld 2.0.0 · ios 27.2', 'support@pickld.me');
    expect(url.startsWith('mailto:support@pickld.me?subject=Pickld%20feedback&body=')).toBe(true);
    expect(decodeURIComponent(url.split('body=')[1]!)).toBe('\n\n—\nPickld 2.0.0 · ios 27.2');
  });
});
