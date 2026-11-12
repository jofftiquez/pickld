import { incomingLink, jarUrl, profileUrl } from '../links';

const JAR = 'b0000000-0000-4000-8000-000000000101';

describe('incomingLink', () => {
  it.each([
    ['https://pickld.me/dale', '/u/dale'],
    ['https://pickld.me/dale/', '/u/dale'],
    ['https://www.pickld.me/Dale.S_1', '/u/Dale.S_1'],
    ['https://pickld.me/u/dale', '/u/dale'],
    [`https://pickld.me/j/${JAR}`, `/jar/${JAR}`],
    [`https://pickld.me/j/${JAR.toUpperCase()}`, `/jar/${JAR}`],
    [`pickld://jar/${JAR}`, `/jar/${JAR}`],
    [`pickld://j/${JAR}`, `/jar/${JAR}`],
    ['pickld://u/dale', '/u/dale'],
    ['https://pickld.me/auth/callback?code=abc', '/auth/callback?code=abc'],
    ['pickld://auth/callback?code=abc', '/auth/callback?code=abc'],
  ])('%s opens %s', (url, href) => {
    expect(incomingLink(url)).toEqual({ kind: 'route', href });
  });

  it.each(['https://pickld.me/terms', 'https://pickld.me/privacy', 'https://pickld.me/guidelines'])(
    '%s stays on the web',
    (url) => expect(incomingLink(url)).toEqual({ kind: 'web', url }),
  );

  it.each([
    'https://pickld.me/j/not-a-uuid',
    'https://pickld.me/ab', // too short for a username
    'https://pickld.me/dale/readers',
    'https://pickld.me/a/b/c',
    'https://evil.example/dale',
    `https://pickld.me.evil.example/j/${JAR}`,
    'pickld://dale', // the app scheme has no bare-username form
    'javascript:alert(1)',
    'not a url',
  ])('%s is unknown', (url) => expect(incomingLink(url)).toEqual({ kind: 'unknown' }));

  it('round-trips the links the app shares', () => {
    expect(incomingLink(profileUrl('dale'))).toEqual({ kind: 'route', href: '/u/dale' });
    expect(incomingLink(jarUrl(JAR))).toEqual({ kind: 'route', href: `/jar/${JAR}` });
  });
});
