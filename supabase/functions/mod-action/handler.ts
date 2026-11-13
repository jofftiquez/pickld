// fn:mod-action (M3-23; FR-MOD-04, FR-MOD-05, FR-SAF-05, FR-SAF-06; D-10, D-11). The moderation console
// calls this for Keep, Remove, Remove and warn and Escalate. It validates the input and calls
// mod_decide() (0041) as the moderator, with their own JWT and no service key: Postgres checks the
// moderator role, takes the actor from the JWT, applies the decision (the owner's moment and notification
// change in the same transaction), counts strikes and writes the audit row. Appeals are queue items too, so
// Keep on an appeal overturns the removal and Remove upholds it.
//
// POST { itemId, action: 'keep' | 'remove' | 'remove_warn' | 'escalate', guideline?, note? }
//   guideline: the report reason the content broke; required for remove and remove_warn.
//   → { data: { result, itemId, status, restored? } }
//   → { error: { code, message } }   400 invalid, 401 signed out, 403 not_moderator | same_moderator |
//                                    own_content, 404 not_found, 409 already_decided, 422 unsupported,
//                                    405 method
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';

export const GUIDELINES = ['sexual', 'harassment', 'violence', 'hate', 'spam', 'under_13', 'other'] as const;

export const modActionInput = z.object({
  itemId: z.uuid(),
  action: z.enum(['keep', 'remove', 'remove_warn', 'escalate']),
  guideline: z.enum(GUIDELINES).optional(),
  note: z.string().trim().max(500).optional(),
}).refine((v) => v.guideline !== undefined || (v.action !== 'remove' && v.action !== 'remove_warn'), {
  message: 'A removal needs a guideline.',
  path: ['guideline'],
});

export interface ModActionDeps {
  userClient: (jwt: string) => SupabaseClient;
}

const decision = z.object({
  result: z.string(),
  item_id: z.string().optional(),
  status: z.string().optional(),
  restored: z.boolean().optional(),
});

const REFUSED: Record<string, [number, string]> = {
  not_found: [404, 'This item doesn’t exist.'],
  already_decided: [409, 'Someone already decided this item.'],
  same_moderator: [403, 'A different moderator has to decide this appeal.'],
  own_content: [403, 'You can’t decide about your own content.'],
  unsupported: [422, 'Jar and profile reports can only be kept or escalated.'],
};

export async function handleModAction(req: Request, deps: ModActionDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const db = deps.userClient(jwt);
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth.user) return fail(401, 'unauthorized', 'Sign in first.');
  if (auth.user.app_metadata?.role !== 'moderator') return fail(403, 'not_moderator', 'Moderators only.');

  const input = modActionInput.safeParse(await readJson(req));
  if (!input.success) return fail(400, 'invalid_input', 'Check the request.', z.flattenError(input.error).fieldErrors);
  const { itemId, action, guideline, note } = input.data;

  const { data, error } = await db.rpc('mod_decide', {
    p_item: itemId,
    p_action: action,
    p_guideline: guideline ?? null,
    p_note: note || null,
  });
  if (error) {
    if (error.code === '42501') return fail(403, 'not_moderator', 'Moderators only.');
    if (error.code === '22023') return fail(400, 'invalid_input', 'Check the request.');
    throw new Error(`mod_decide: ${error.code}`);
  }
  const d = decision.parse(data);
  const refused = REFUSED[d.result];
  if (refused) return fail(refused[0], d.result, refused[1]);
  return ok({
    result: d.result,
    itemId: d.item_id,
    status: d.status,
    ...(d.restored === undefined ? {} : { restored: d.restored }),
  });
}
