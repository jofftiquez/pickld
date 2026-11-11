// fn:moderate against the local stack: insert → live, replace → swap, the database refuses live from
// any other role, and the provider seam (review, remove, a proposal that changes during the check).
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { userClient } from '../_shared/env.ts';
import { handleModerate } from '../moderate/handler.ts';
import { autoApprove, type ModerationContent, type ModerationProvider } from '../moderate/provider.ts';
import { admin, cleanup, createUser, insert, localDate, request, type TestUser } from './local.ts';

let owner: TestUser, reader: TestUser, outsider: TestUser;
let db: Awaited<ReturnType<typeof admin>>;
let jarId: string;

const call = async (body: unknown, user?: TestUser, provider: ModerationProvider = autoApprove) => {
  const res = await handleModerate(request('moderate', { jwt: user?.jwt, body }), {
    userClient,
    serviceClient: () => db,
    provider,
  });
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
};

/** The owner adds a moment the way the app does: as themselves, status checking. */
async function addMoment(slot: string, caption: string | null = null): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await userClient(owner.jwt).from('moments').insert({
    id,
    jar_id: jarId,
    user_id: owner.id,
    slot,
    status: 'checking',
    photo_path: `moments/${owner.id}/${id}/full.jpg`,
    thumb_path: `moments/${owner.id}/${id}/thumb.jpg`,
    caption,
  });
  if (error) throw new Error(`insert moment: ${error.message}`);
  return id;
}

const readerSees = async (id: string) =>
  (await userClient(reader.jwt).from('moments').select('id, photo_path, caption, status').eq('id', id)).data ?? [];
const row = async (id: string) =>
  (await db.from('moments').select('*').eq('id', id).single()).data as Record<string, unknown>;

Deno.test('setup', async () => {
  owner = await createUser('owner');
  reader = await createUser('reader');
  outsider = await createUser('outsider');
  db = await admin();
  await insert('follows', { reader_id: reader.id, author_id: owner.id });
  const jar = await insert<{ id: string }>('jars', {
    user_id: owner.id,
    local_date: localDate(),
    tz: 'Asia/Manila',
    visibility: 'readers',
    published_at: new Date().toISOString(),
  });
  jarId = jar.id;
});

Deno.test('insert → live: a new moment goes live through the function within 10 seconds', async () => {
  const started = performance.now();
  const id = await addMoment('morning', 'coffee');
  assertEquals((await readerSees(id)).length, 0, 'hidden while checking');
  const { status, json } = await call({ momentId: id }, owner);
  const elapsed = performance.now() - started;
  assertEquals(status, 200, JSON.stringify(json));
  assertEquals(json.data, { momentId: id, outcome: 'live', status: 'live' });
  assert(elapsed < 10_000, `took ${elapsed} ms`);
  assertEquals((await readerSees(id)).map((m) => m.status), ['live'], 'the reader sees it');

  const again = await call({ momentId: id }, owner);
  assertEquals(again.json.data.outcome, 'nothing_to_check', 'calling again is harmless');
});

Deno.test('replace → swap: the replacement stays hidden until the function swaps it in', async () => {
  const id = await addMoment('afternoon', 'before');
  await call({ momentId: id }, owner);
  const newPhoto = `moments/${owner.id}/${crypto.randomUUID()}/full.jpg`;
  const newThumb = newPhoto.replace('full.jpg', 'thumb.jpg');
  const { error } = await userClient(owner.jwt).from('moments')
    .update({ photo_path: newPhoto, thumb_path: newThumb, caption: 'after' }).eq('id', id);
  if (error) throw new Error(error.message);
  const [before] = await readerSees(id);
  assert(before.photo_path !== newPhoto && before.caption === 'before', 'the reader still sees the old version');

  const { json } = await call({ momentId: id }, owner);
  assertEquals(json.data, { momentId: id, outcome: 'swapped', status: 'live' });
  const [after] = await readerSees(id);
  assertEquals([after.photo_path, after.caption], [newPhoto, 'after']);
  const r = await row(id);
  assertEquals([r.thumb_path, r.pending_photo_path, r.pending_since], [newThumb, null, null]);
});

Deno.test('the database refuses live and removed from every other role', async () => {
  const id = await addMoment('evening');
  const asOwner = await userClient(owner.jwt).from('moments').update({ status: 'live' }).eq('id', id);
  assertEquals(asOwner.error?.code, '42501', 'owner');
  const asServer = await db.from('moments').update({ status: 'live' }).eq('id', id);
  assertEquals(asServer.error?.code, '42501', 'service_role');
  const removedByServer = await db.from('moments').update({ status: 'removed' }).eq('id', id);
  assertEquals(removedByServer.error?.code, '42501', 'service_role, removed');
  for (const u of [reader, outsider]) {
    const { data } = await userClient(u.jwt).from('moments').update({ status: 'live' }).eq('id', id).select('id');
    assertEquals(data ?? [], [], `${u.name} updates no rows`);
  }
  for (const u of [owner, reader]) {
    const { error } = await userClient(u.jwt).rpc('moderation_apply', {
      p_moment_id: id,
      p_pending_since: null,
      p_decision: 'approve',
      p_provider: 'me',
    });
    assert(error, `${u.name} cannot call moderation_apply`);
  }
  assertEquals((await row(id)).status, 'checking');
});

Deno.test('only the owner can ask, with valid input', async () => {
  const id = await addMoment('selfie');
  assertEquals((await call({ momentId: id })).status, 401);
  assertEquals((await call({ momentId: id }, reader)).status, 404);
  assertEquals((await call({ momentId: crypto.randomUUID() }, owner)).status, 404);
  assertEquals((await call({ momentId: 'nope' }, owner)).status, 400);
  assertEquals((await call({ momentId: id, extra: 1 }, owner)).status, 400);
  assertEquals((await call('not json', owner)).status, 400);
  assertEquals((await call({ momentId: id }, reader)).json.error.code, 'not_found');
  assertEquals((await row(id)).status, 'checking', 'nobody else can trigger it');
});

Deno.test('provider seam: review queues, remove removes, and the provider sees the proposal', async () => {
  const seen: ModerationContent[] = [];
  const review: ModerationProvider = {
    ...autoApprove,
    name: 'stub-review',
    check: (
      c,
    ) => (seen.push(c), Promise.resolve({ decision: 'review', scores: { sexual: 0.5 }, reason: 'borderline' })),
  };
  const remove: ModerationProvider = {
    ...autoApprove,
    name: 'stub-remove',
    check: () => Promise.resolve({ decision: 'remove', scores: { violence: 0.99 }, reason: 'violence' }),
  };

  const queued = await addMoment('ootd', 'hmm');
  const r1 = await call({ momentId: queued }, owner, review);
  assertEquals(r1.json.data, { momentId: queued, outcome: 'queued', status: 'checking' });
  assertEquals(seen[0].caption, 'hmm');
  const { data: items } = await db.from('moderation_items').select('status, scores').eq('moment_id', queued);
  assertEquals(items, [{ status: 'pending', scores: { provider: 'stub-review', scores: { sexual: 0.5 } } }]);
  const r2 = await call({ momentId: queued }, owner);
  assertEquals(r2.json.data.status, 'checking', 'auto-approve cannot release a queued moment');

  const removed = await addMoment('whereami');
  const r3 = await call({ momentId: removed }, owner, remove);
  assertEquals(r3.json.data, { momentId: removed, outcome: 'removed', status: 'removed' });
});

Deno.test('a proposal changed during the check is checked again, never approved unchecked', async () => {
  const id = await addMoment('mebusywith', 'v1');
  await call({ momentId: id }, owner);
  await userClient(owner.jwt).from('moments').update({ caption: 'v2' }).eq('id', id);
  const seen: (string | null)[] = [];
  const racing: ModerationProvider = {
    ...autoApprove,
    name: 'stub-racing',
    async check(c) {
      seen.push(c.caption);
      if (seen.length === 1) {
        // The owner edits again while v2 is being checked.
        await userClient(owner.jwt).from('moments').update({ caption: 'v3' }).eq('id', id);
      }
      return { decision: 'approve' };
    },
  };
  const { json } = await call({ momentId: id }, owner, racing);
  assertEquals(seen, ['v2', 'v3']);
  assertEquals(json.data.outcome, 'swapped');
  assertEquals((await row(id)).caption, 'v3', 'the version that was checked last is the one that went live');
});

// ---------------------------------------------------------------- text path (M3-10, 0016)

/** The reader comments on the owner's jar the way the app does: as themselves, hidden until checked. */
async function addComment(body: string): Promise<string> {
  const { data, error } = await userClient(reader.jwt).from('comments')
    .insert({ jar_id: jarId, user_id: reader.id, body }).select('id').single();
  if (error) throw new Error(`insert comment: ${error.message}`);
  return (data as { id: string }).id;
}
const ownerSeesComment = async (id: string) =>
  ((await userClient(owner.jwt).from('comments').select('id').eq('id', id)).data ?? []).length === 1;

Deno.test('comment pass path (D-22): visible to others as soon as the function sees it', async () => {
  const id = await addComment('Love the light');
  assertEquals(await ownerSeesComment(id), false, 'hidden from the jar owner while checked');
  const { status, json } = await call({ commentId: id }, reader);
  assertEquals(status, 200, JSON.stringify(json));
  assertEquals(json.data, { commentId: id, outcome: 'visible' });
  assertEquals(await ownerSeesComment(id), true, 'the jar owner sees it');
  assertEquals(
    (await call({ commentId: id }, reader)).json.data.outcome,
    'nothing_to_check',
    'calling again is harmless',
  );
});

Deno.test('comments: only the author can ask, and nobody can unhide one directly', async () => {
  const id = await addComment('Mine');
  assertEquals((await call({ commentId: id })).status, 401);
  assertEquals((await call({ commentId: id }, owner)).status, 404, 'the jar owner cannot trigger it');
  assertEquals((await call({ commentId: crypto.randomUUID() }, reader)).status, 404);
  assertEquals((await call({ commentId: id, momentId: id }, reader)).status, 400, 'one id at a time');
  const direct = await db.from('comments').update({ is_hidden: false }).eq('id', id);
  assertEquals(direct.error?.code, '42501', 'service_role cannot unhide');
  assertEquals(await ownerSeesComment(id), false);
});

Deno.test('comments: the provider seam can queue or refuse text', async () => {
  const seen: string[] = [];
  const refuse: ModerationProvider = {
    ...autoApprove,
    name: 'stub-text-remove',
    checkText: (
      c,
    ) => (seen.push(`${c.kind}:${c.text}`),
      Promise.resolve({ decision: 'remove', scores: { harassment: 0.98 }, reason: 'harassment' })),
  };
  const id = await addComment('you are awful');
  const { json } = await call({ commentId: id }, reader, refuse);
  assertEquals(json.data.outcome, 'removed');
  assertEquals(seen, ['comment:you are awful']);
  assertEquals(await ownerSeesComment(id), false, 'a refused comment stays hidden');
});

Deno.test('reserved usernames are refused at save, in any letter case', async () => {
  const me = userClient(outsider.jwt).from('profiles');
  for (const name of ['settings', 'Explore', 'PICKLD']) {
    const { error } = await me.update({ username: name }).eq('id', outsider.id);
    assertEquals(error?.code, '23514', name);
    assertEquals(error?.message, 'username_reserved', name);
  }
  const fine = `jar_${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await me.update({ username: fine }).eq('id', outsider.id);
  assertEquals(error, null, 'a name that only contains a route word is fine');
});

Deno.test('cleanup', cleanup);
