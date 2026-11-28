// fn:apple-token (FR-ACC-01, FR-PRV-03). Right after Sign in with Apple the app sends Apple's one-time
// authorization code here. It is traded for a refresh token, kept in apple_tokens (0171, service role only) so
// that deleting the account can revoke the person's Sign in with Apple link (_shared/apple.ts). The Apple user the
// code belongs to must be the caller's own Apple identity. Without the Apple key secrets nothing is stored.
//
// POST { code, clientId }   clientId: the app's bundle id (com.teamops.apps.Pickld or com.teamops.apps.Pickld.local)
//   → { data: { stored: boolean } }
//   → { error: { code, message } }   400 invalid input, 401 signed out, 403 not_apple, 405 method, 502 apple
import type { SupabaseClient } from '../_shared/deps.ts';
import { z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { APPLE_CLIENT_IDS, type AppleKey, exchangeAppleCode } from '../_shared/apple.ts';

export const AppleTokenInput = z.strictObject({
  code: z.string().min(1).max(1024),
  clientId: z.enum(APPLE_CLIENT_IDS),
});

export interface AppleTokenDeps {
  userClient: (jwt: string) => SupabaseClient;
  key: () => AppleKey | null;
  exchange: typeof exchangeAppleCode;
  store: (userId: string, clientId: string, refreshToken: string) => Promise<void>;
}

export async function handleAppleToken(req: Request, deps: AppleTokenDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const { data: auth } = await deps.userClient(jwt).auth.getUser(jwt);
  if (!auth.user) return fail(401, 'unauthorized', 'Sign in first.');
  const parsed = AppleTokenInput.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, 'invalid_input', 'Send the Apple authorization code and the app’s bundle id.');
  const apple = auth.user.identities?.find((i) => i.provider === 'apple');
  if (!apple) return fail(403, 'not_apple', 'This account doesn’t sign in with Apple.');

  const key = deps.key();
  if (!key) return ok({ stored: false });
  let token: { refreshToken: string; sub: string };
  try {
    token = await deps.exchange(key, parsed.data.clientId, parsed.data.code);
  } catch {
    return fail(502, 'apple', 'Apple didn’t accept the code.');
  }
  if (token.sub !== apple.id) return fail(403, 'not_apple', 'That code belongs to another Apple account.');
  await deps.store(auth.user.id, parsed.data.clientId, token.refreshToken);
  return ok({ stored: true });
}

export function serviceStore(db: SupabaseClient): AppleTokenDeps['store'] {
  return async (userId, clientId, refreshToken) => {
    const { error } = await db.from('apple_tokens')
      .upsert({
        user_id: userId,
        client_id: clientId,
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(`apple_tokens: ${error.code}`);
  };
}
