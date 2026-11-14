import { serviceClient, waitlistSecret } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleWaitlistJoin, type JoinResult } from './handler.ts';

Deno.serve(
  withSentry('waitlist-join', (req) =>
    handleWaitlistJoin(req, {
      secret: waitlistSecret,
      join: async (email, ipHash, source) => {
        const { data, error } = await serviceClient().rpc('waitlist_join', {
          p_email: email,
          p_ip_hash: ipHash,
          p_source: source,
        });
        if (error) throw new Error(`waitlist_join: ${error.message}`);
        return data as JoinResult;
      },
    })),
);
