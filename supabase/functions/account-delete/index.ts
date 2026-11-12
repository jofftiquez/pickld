import { userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleAccountDelete } from './handler.ts';

Deno.serve(withSentry('account-delete', (req) => handleAccountDelete(req, { userClient })));
