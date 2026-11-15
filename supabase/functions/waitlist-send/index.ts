import { emailConfig, siteUrl, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleWaitlistSend, type Released, sendWithResend } from './handler.ts';

Deno.serve(
  withSentry('waitlist-send', (req) =>
    handleWaitlistSend(req, {
      isFounder: async (jwt) => {
        const { data } = await userClient(jwt).auth.getUser(jwt);
        if (!data.user) return null;
        const meta = data.user.app_metadata ?? {};
        return meta.role === 'moderator' && meta.founder === true;
      },
      release: async (jwt, count, resendExpired) => {
        const { data, error } = await userClient(jwt).rpc('waitlist_release', {
          p_count: count,
          p_resend_expired: resendExpired,
        });
        if (error) throw new Error(`waitlist_release: ${error.code} ${error.message}`);
        return (data ?? []) as Released[];
      },
      markSent: async (jwt, emails) => {
        const { data, error } = await userClient(jwt).rpc('waitlist_mark_sent', { p_emails: emails });
        if (error) throw new Error(`waitlist_mark_sent: ${error.code} ${error.message}`);
        return data as number;
      },
      email: emailConfig,
      site: siteUrl,
      send: (apiKey, emails, key) => sendWithResend(apiKey, emails, key),
    })),
);
