import { userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleModAction } from './handler.ts';

Deno.serve(withSentry('mod-action', (req) => handleModAction(req, { userClient })));
