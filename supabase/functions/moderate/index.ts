import { serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleModerate } from './handler.ts';
import { autoApprove } from './provider.ts';

// D-22: the early version auto-approves. The full pipeline (T-105) replaces `autoApprove` here.
Deno.serve(withSentry('moderate', (req) => handleModerate(req, { userClient, serviceClient, provider: autoApprove })));
