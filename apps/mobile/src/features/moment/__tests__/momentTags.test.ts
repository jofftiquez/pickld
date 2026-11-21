import { captionParts, completeMention, typingMention } from '../momentTags';

const mara = { userId: 'u1', username: 'mara.lim' };

describe('captionParts', () => {
  it('links only the @names the viewer may see tagged, case-insensitively, and keeps every word', () => {
    const caption = 'Lunch with @Mara.Lim and @jun, not me@mail.com.';
    const parts = captionParts(caption, [mara]);
    expect(parts).toEqual([
      { kind: 'text', text: 'Lunch with ' },
      { kind: 'mention', text: '@Mara.Lim', tag: mara },
      { kind: 'text', text: ' and ' },
      { kind: 'mention', text: '@jun', tag: null },
      { kind: 'text', text: ', not me@mail.com.' },
    ]);
    expect(parts.map((p) => p.text).join('')).toBe(caption);
  });

  it('leaves a full stop after a name outside the link', () => {
    const parts = captionParts('Thanks @mara.lim.', [mara]);
    expect(parts).toEqual([
      { kind: 'text', text: 'Thanks ' },
      { kind: 'mention', text: '@mara.lim', tag: mara },
      { kind: 'text', text: '.' },
    ]);
  });

  it('treats a name shorter than three characters as words', () => {
    expect(captionParts('hi @ab', [])).toEqual([{ kind: 'text', text: 'hi @ab' }]);
  });
});

describe('caption @ completion', () => {
  it('finds the @word being typed at the end, even an empty one', () => {
    expect(typingMention('with @ma')).toBe('ma');
    expect(typingMention('with @')).toBe('');
    expect(typingMention('with @mara ')).toBeNull();
    expect(typingMention('me@mail')).toBeNull();
  });

  it('replaces only that word with the chosen username and a space', () => {
    expect(completeMention('lunch @ma', 'mara.lim')).toBe('lunch @mara.lim ');
    expect(completeMention('@', 'jun')).toBe('@jun ');
    expect(completeMention('no mention', 'jun')).toBe('no mention');
  });
});
