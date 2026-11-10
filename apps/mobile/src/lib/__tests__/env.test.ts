import { isServiceKey, parseEnv } from '../env';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (role: string) => `${b64({ alg: 'HS256' })}.${b64({ iss: 'supabase', role })}.${'s'.repeat(43)}`;
const url = 'http://127.0.0.1:54321';

describe('env validation', () => {
  it('accepts a URL and an anon or publishable key', () => {
    expect(parseEnv({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') })).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: url,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
    });
    const publishable = ['sb', 'publishable', 'abcdefghijklmnopqrst'].join('_');
    expect(() => parseEnv({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: publishable })).not.toThrow();
  });

  it('refuses service keys', () => {
    const secret = ['sb', 'secret', 'abcdefghijklmnopqrst'].join('_');
    expect(isServiceKey(jwt('service_role'))).toBe(true);
    expect(isServiceKey(secret)).toBe(true);
    expect(isServiceKey(jwt('anon'))).toBe(false);
    expect(() =>
      parseEnv({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') }),
    ).toThrow(/never a service key/);
    expect(() => parseEnv({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: secret })).toThrow(
      /service key/,
    );
  });

  it('names missing or malformed values', () => {
    expect(() => parseEnv({})).toThrow(/EXPO_PUBLIC_SUPABASE_URL.*EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    expect(() =>
      parseEnv({ EXPO_PUBLIC_SUPABASE_URL: 'not a url', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') }),
    ).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(() =>
      parseEnv({ EXPO_PUBLIC_SUPABASE_URL: 'ftp://x.example', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') }),
    ).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });
});
