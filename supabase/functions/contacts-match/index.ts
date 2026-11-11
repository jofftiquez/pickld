import { contactHashSecret, serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleContactsMatch, serviceStore } from './handler.ts';

Deno.serve(
  withSentry('contacts-match', (req) =>
    handleContactsMatch(req, {
      userClient,
      store: () => serviceStore(serviceClient()),
      secret: contactHashSecret,
    })),
);
