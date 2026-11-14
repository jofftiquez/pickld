import { incomingLink, inviteTokenFromUrl, jarUrl, normalizeInviteToken, profileUrl } from '../links';

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
    ['https://pickld.me/i/K7M2QX', '/i/K7M2QX'],
    ['https://pickld.me/i/k7m2qx', '/i/K7M2QX'],
    ['https://pickld.me/i/AB23CD45EF', '/i/AB23CD45EF'],
    ['pickld://i/K7M2QX', '/i/K7M2QX'],
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
    'https://pickld.me/i/K7M2Q0', // 0 is not in the code alphabet
    'https://pickld.me/i/K7M2QXY', // 7 characters: neither a code nor a link
    'https://pickld.me/i/K7M2QX/extra',
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

describe('invite tokens', () => {
  it.each([
    ['K7M2QX', 'K7M2QX'],
    [' k7m-2qx ', 'K7M2QX'],
    ['ab23 cd45 ef', 'AB23CD45EF'],
    ['K7M2Q', null],
    ['K7M2QI', null], // I is left out of the alphabet
    ['K7M2QX9', null],
  ])('normalizeInviteToken(%j) is %j', (raw, token) => expect(normalizeInviteToken(raw)).toBe(token));

  it.each([
    ['https://pickld.me/i/K7M2QX', 'K7M2QX'],
    ['https://www.pickld.me/i/ab23cd45ef/', 'AB23CD45EF'],
    ['http://pickld.me/i/K7M2QX', null], // a QR from Pickld is always https
    ['https://pickld.me.evil.example/i/K7M2QX', null],
    ['https://pickld.me/dale', null],
    ['pickld://i/K7M2QX', null],
    ['K7M2QX', null],
  ])('inviteTokenFromUrl(%j) is %j', (url, token) => expect(inviteTokenFromUrl(url)).toBe(token));

  it('reads the app scheme only when asked', () => {
    expect(inviteTokenFromUrl('pickld://i/K7M2QX', { appScheme: true })).toBe('K7M2QX');
  });
});
