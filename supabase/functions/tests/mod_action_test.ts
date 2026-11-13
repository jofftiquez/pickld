// fn:mod-action (M3-23) against the local stack: only moderators decide; a removal needs a guideline;
// Remove updates the owner's moment and notification at once and writes an audit row; an appeal is
// decided by a different moderator and Keep restores the moment; a decided item can't be decided again.
// fn:account-jobs lifts strike suspensions that have run out (D-11).
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { userClient } from '../_shared/env.ts';
import { handleAccountJobs, serviceStore } from '../account-jobs/handler.ts';
import { handleModAction } from '../mod-action/handler.ts';
import { admin, cleanup, createUser, insert, localDate, localS3, request, type TestUser } from './local.ts';

let owner: TestUser, mod1: TestUser, mod2: TestUser;
let db: Awaited<ReturnType<typeof admin>>;
let jarId: string;

const call = async (body: unknown, user?: TestUser, method = 'POST') => {
  const res = await handleModAction(request('mod-action', { jwt: user?.jwt, body, method }), { userClient });
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
};

/** A checking moment of the owner's with a pending auto-check item, as fn:moderate leaves a borderline score. */
async function queued(slot: string): Promise<{ momentId: string; itemId: string }> {
  const momentId = crypto.randomUUID();
  const { error } = await userClient(owner.jwt).from('moments').insert({
    id: momentId,
    jar_id: jarId,
    user_id: owner.id,
    slot,
    status: 'checking',
    photo_path: `moments/${owner.id}/${momentId}/full.jpg`,
    thumb_path: `moments/${owner.id}/${momentId}/thumb.jpg`,
  });
  if (error) throw new Error(`insert moment: ${error.message}`);
  const item = await insert<{ id: string }>('moderation_items', { moment_id: momentId, source: 'auto_check' });
  return { momentId, itemId: item.id };
}

const momentStatus = async (id: string) =>
  (await db.from('moments').select('status').eq('id', id).single()).data?.status;

Deno.test('setup', async () => {
  owner = await createUser('owner');
  mod1 = await createUser('mod1', { role: 'moderator' });
  mod2 = await createUser('mod2', { role: 'moderator' });
  db = await admin();
  const jar = await insert<{ id: string }>('jars', {
    user_id: owner.id,
    local_date: localDate(),
    tz: 'Asia/Manila',
    visibility: 'readers',
    published_at: new Date().toISOString(),
  });
  jarId = jar.id;
});

Deno.test('only moderators decide; bad input is refused', async () => {
  const { itemId } = await queued('morning');
  assertEquals((await call({ itemId, action: 'keep' })).status, 401);
  const asOwner = await call({ itemId, action: 'keep' }, owner);
  assertEquals([asOwner.status, asOwner.json.error.code], [403, 'not_moderator']);
  assertEquals((await call(undefined, mod1, 'GET')).status, 405);
  assertEquals((await call({ itemId: 'nope', action: 'keep' }, mod1)).status, 400);
  const noGuideline = await call({ itemId, action: 'remove' }, mod1);
  assertEquals([noGuideline.status, Object.keys(noGuideline.json.error.details)], [400, ['guideline']]);
  const missing = await call({ itemId: crypto.randomUUID(), action: 'keep' }, mod1);
  assertEquals([missing.status, missing.json.error.code], [404, 'not_found']);
});

Deno.test('remove, appeal, overturn by a different moderator', async () => {
  const { momentId, itemId } = await queued('evening');
  const removed = await call({ itemId, action: 'remove', guideline: 'violence', note: 'gore' }, mod1);
  assertEquals(removed.status, 200, JSON.stringify(removed.json));
  assertEquals(removed.json.data, { result: 'removed', itemId, status: 'removed' });

  // The owner's moment and notification change in the same transaction (well within a minute).
  assertEquals(await momentStatus(momentId), 'removed');
  const { data: notes } = await userClient(owner.jwt).from('notifications').select('type').eq('moment_id', momentId);
  assertEquals(notes?.map((n) => n.type), ['removed']);
  const { data: audit } = await db.from('audit_log').select('actor_id, action, data').eq('target_id', momentId);
  assertEquals(audit?.map((a) => [a.actor_id, a.action, a.data.guideline]), [[mod1.id, 'remove', 'violence']]);

  const again = await call({ itemId, action: 'keep' }, mod2);
  assertEquals([again.status, again.json.error.code], [409, 'already_decided']);

  // The owner reads the guideline and appeals; the appeal joins the queue.
  const { data: removal } = await userClient(owner.jwt).rpc('my_removal', { p_moment: momentId });
  assertEquals(removal, [{ item_id: itemId, guideline: 'violence', can_appeal: true, appeal_status: null }]);
  const { error: appealErr } = await userClient(owner.jwt).from('appeals')
    .insert({ moderation_item_id: itemId, user_id: owner.id, message: 'fake blood' });
  assertEquals(appealErr, null);
  const { data: appealItem } = await db.from('moderation_items').select('id').eq('moment_id', momentId)
    .eq('source', 'appeal').single();
  assert(appealItem);

  const same = await call({ itemId: appealItem.id, action: 'keep' }, mod1);
  assertEquals([same.status, same.json.error.code], [403, 'same_moderator']);
  const overturned = await call({ itemId: appealItem.id, action: 'keep' }, mod2);
  assertEquals(overturned.status, 200, JSON.stringify(overturned.json));
  assertEquals(overturned.json.data, { result: 'overturned', itemId: appealItem.id, status: 'kept', restored: true });
  assertEquals(await momentStatus(momentId), 'live');
});

Deno.test('fn:account-jobs lifts expired strike suspensions', async () => {
  const { error } = await db.from('profiles')
    .update({ status: 'suspended', suspended_until: new Date(Date.now() - 60_000).toISOString() }).eq('id', owner.id);
  assertEquals(error, null);
  const secret = 'account-jobs-test-secret-at-least-32-characters';
  const store = serviceStore(db, await localS3());
  const res = await handleAccountJobs(
    new Request('http://fn.local/account-jobs', { method: 'POST', headers: { 'x-jobs-secret': secret } }),
    { store: () => store, secret: () => secret },
  );
  const json = await res.json();
  assertEquals(res.status, 200);
  assert(json.data.lifted >= 1, JSON.stringify(json));
  const { data } = await db.from('profiles').select('status, suspended_until').eq('id', owner.id).single();
  assertEquals(data, { status: 'active', suspended_until: null });
});

Deno.test('cleanup', cleanup);
