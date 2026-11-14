import { photoBaseUrl, photoTokenSecret, serviceClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { type CheckResult, handleInvite } from './handler.ts';

Deno.serve(
  withSentry('invite', (req) =>
    handleInvite(req, {
      // The photo token secret is always set; the "invite:" prefix keeps these hashes apart from its tokens.
      hashKey: photoTokenSecret,
      forwardSecret: () => Deno.env.get('WAITLIST_SECRET') ?? null,
      check: async (token, ipHash) => {
        const { data, error } = await serviceClient().rpc('invite_check', { p_token: token, p_ip_hash: ipHash });
        if (error) throw new Error(`invite_check: ${error.message}`);
        return data as CheckResult;
      },
      photoBaseUrl,
      tokenSecret: photoTokenSecret,
    })),
);
