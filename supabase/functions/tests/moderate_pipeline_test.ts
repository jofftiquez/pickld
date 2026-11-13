// The full check (M2-20): the CSAM gate runs first and a match stops everything, thresholds decide, a
// borderline photo gets a second opinion that never changes the decision, every step fails closed, and
// the OpenAI adapters speak the real request shape (against a local stand-in, no key needed). Then the
// handler against the local stack: a block suspends, records an incident and never queues (FR-SAF-04).
import { assert, assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1';
import { userClient } from '../_shared/env.ts';
import { selectProvider } from '../moderate/config.ts';
import { handleModerate } from '../moderate/handler.ts';
import { openAIModeration, openAISecondOpinion, type Scorer, type SecondOpinionSource } from '../moderate/openai.ts';
import { fullCheck, hashListMatcher, MissingObjectError } from '../moderate/pipeline.ts';
import type { ModerationContent, ModerationProvider } from '../moderate/provider.ts';
import { decide, type Scores, THRESHOLDS } from '../moderate/thresholds.ts';
import { admin, cleanup, createUser, insert, localDate, request, type TestUser } from './local.ts';

const PHOTO = new TextEncoder().encode('full photo bytes');
const THUMB = new TextEncoder().encode('thumb bytes');
const content: ModerationContent = {
  momentId: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  photoPath: 'moments/u/m/full.jpg',
  thumbPath: 'moments/u/m/thumb.jpg',
  caption: 'beach day',
};
const read = (key: string) =>
  Promise.resolve(key.endsWith('full.jpg') ? PHOTO : key.endsWith('thumb.jpg') ? THUMB : null);

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function stubScorer(scores: Scores, model = THRESHOLDS.model): Scorer & { calls: number } {
  const s = {
    name: 'stub',
    calls: 0,
    scoreImage: () => {
      s.calls++;
      return Promise.resolve({ model, scores });
    },
    scoreText: () => {
      s.calls++;
      return Promise.resolve({ model, scores });
    },
  };
  return s;
}
const opinion: SecondOpinionSource = {
  ask: (_t, _c, concern) => Promise.resolve({ model: 'vision', verdict: 'unsure', reason: `looked at ${concern}` }),
};
const pipeline = (scorer: Scorer, extra: Partial<Parameters<typeof fullCheck>[0]> = {}) =>
  fullCheck({ matcher: hashListMatcher([]), scorer, secondOpinion: opinion, read, thresholds: THRESHOLDS, ...extra });

// ---------------------------------------------------------------- thresholds
Deno.test('decide: below review approves, between queues, at remove removes, the widest margin is the reason', () => {
  assertEquals(decide({ sexual: 0.39, violence: 0.1 }, THRESHOLDS.photo), { decision: 'approve' });
  assertEquals(decide({ sexual: 0.4 }, THRESHOLDS.photo), { decision: 'review', reason: 'sexual' });
  assertEquals(decide({ 'sexual': 0.5, 'sexual/minors': 0.2 }, THRESHOLDS.photo), {
    decision: 'review',
    reason: 'sexual/minors',
  });
  assertEquals(decide({ sexual: 0.95, violence: 0.6 }, THRESHOLDS.photo), { decision: 'remove', reason: 'sexual' });
  // Self-harm and minors are never removed automatically: a human decides.
  assertEquals(decide({ 'self-harm': 0.99 }, THRESHOLDS.photo).decision, 'review');
  assertEquals(decide({ 'sexual/minors': 0.99 }, THRESHOLDS.photo).decision, 'review');
  assertEquals(decide({ harassment: 0.99 }, THRESHOLDS.text).decision, 'review', 'text is never auto-removed');
});

// ---------------------------------------------------------------- the pipeline with stubs
Deno.test('a hash match blocks before any score is asked', async () => {
  const scorer = stubScorer({});
  const v = await pipeline(scorer, { matcher: hashListMatcher([await sha256(PHOTO)]) }).check(content);
  assertEquals(v.decision, 'block');
  assertEquals(scorer.calls, 0, 'the thumbnail never goes to OpenAI');
  if (v.decision === 'block') assertEquals(v.match, { sha256: await sha256(PHOTO) });
});

Deno.test('the matcher sees the full photo, the scorer the thumbnail', async () => {
  const seen: string[] = [];
  const check = fullCheck({
    matcher: {
      name: 'm',
      match: (p) => (seen.push(`match:${new TextDecoder().decode(p)}`), Promise.resolve({ matched: false })),
    },
    scorer: {
      name: 's',
      scoreImage: (
        t,
        c,
      ) => (seen.push(`score:${new TextDecoder().decode(t)}:${c}`),
        Promise.resolve({ model: THRESHOLDS.model, scores: {} })),
      scoreText: () => Promise.reject(new Error('unused')),
    },
    secondOpinion: null,
    read,
    thresholds: THRESHOLDS,
  });
  assertEquals(await check.check(content), { decision: 'approve' });
  assertEquals(seen, ['match:full photo bytes', 'score:thumb bytes:beach day']);
});

Deno.test('borderline: queued with a second opinion and the thresholds version', async () => {
  const v = await pipeline(stubScorer({ violence: 0.6 })).check(content);
  assertEquals(v.decision, 'review');
  if (v.decision !== 'review') return;
  assertEquals(v.reason, 'violence');
  assertEquals(v.secondOpinion, { model: 'vision', verdict: 'unsure', reason: 'looked at violence' });
  assertEquals((v.scores as unknown as Record<string, unknown>).thresholds, THRESHOLDS.version);
});

Deno.test('a second opinion that says allow, or fails, never changes the decision', async () => {
  const allow: SecondOpinionSource = { ask: () => Promise.resolve({ model: 'v', verdict: 'allow', reason: 'fine' }) };
  assertEquals(
    (await pipeline(stubScorer({ sexual: 0.5 }), { secondOpinion: allow }).check(content)).decision,
    'review',
  );
  const broken: SecondOpinionSource = { ask: () => Promise.reject(new Error('down')) };
  const v = await pipeline(stubScorer({ sexual: 0.5 }), { secondOpinion: broken }).check(content);
  assertEquals(v.decision, 'review');
  if (v.decision === 'review') assertEquals(v.secondOpinion, undefined);
});

Deno.test('high scores remove without a second opinion; low scores approve', async () => {
  let asked = 0;
  const counting: SecondOpinionSource = { ask: (...a) => (asked++, opinion.ask(...a)) };
  assertEquals(
    (await pipeline(stubScorer({ 'violence/graphic': 0.95 }), { secondOpinion: counting }).check(content)).decision,
    'remove',
  );
  assertEquals(
    (await pipeline(stubScorer({ sexual: 0.01 }), { secondOpinion: counting }).check(content)).decision,
    'approve',
  );
  assertEquals(asked, 0);
});

Deno.test('fails closed: a matcher or scorer error, or a missing photo, throws', async () => {
  await assertRejects(
    () =>
      pipeline(stubScorer({}), { matcher: { name: 'x', match: () => Promise.reject(new Error('timeout')) } }).check(
        content,
      ),
    Error,
    'timeout',
  );
  const failing: Scorer = {
    name: 'x',
    scoreImage: () => Promise.reject(new Error('429')),
    scoreText: () => Promise.reject(new Error('429')),
  };
  await assertRejects(() => pipeline(failing).check(content), Error, '429');
  await assertRejects(() => pipeline(failing).checkText({ kind: 'comment', userId: 'u', text: 'hi' }), Error, '429');
  await assertRejects(
    () => pipeline(stubScorer({})).check({ ...content, photoPath: 'moments/u/m/gone.png' }),
    MissingObjectError,
  );
});

Deno.test('a scorer answering with another model is reported once per call, and still decides', async () => {
  const drift: string[] = [];
  const v = await pipeline(stubScorer({}, 'omni-moderation-2027-01-01'), {
    onModelDrift: (e, a) => drift.push(`${e}->${a}`),
  })
    .check(content);
  assertEquals(v.decision, 'approve');
  assertEquals(drift, [`${THRESHOLDS.model}->omni-moderation-2027-01-01`]);
});

Deno.test('text: harassing comments are queued, ordinary ones approved', async () => {
  assertEquals(
    (await pipeline(stubScorer({ harassment: 0.8 })).checkText({ kind: 'comment', userId: 'u', text: 'x' })).decision,
    'review',
  );
  assertEquals(
    (await pipeline(stubScorer({ harassment: 0.1 })).checkText({ kind: 'comment', userId: 'u', text: 'x' })).decision,
    'approve',
  );
});

// ---------------------------------------------------------------- config
Deno.test('config: auto-approve without a key locally; production refuses it and the hash-list stand-in', () => {
  const env = (vars: Record<string, string>) => ({ get: (n: string) => vars[n] });
  const s3 = () => ({ endpoint: 'http://x', region: 'r', bucket: 'b', accessKeyId: 'a', secretAccessKey: 's' });
  assertEquals(selectProvider(env({}), s3).name, 'auto-approve');
  assertEquals(selectProvider(env({ OPENAI_API_KEY: 'k' }), s3).name, 'full-check/hash-list/openai-moderation');
  assertThrows(() => selectProvider(env({ APP_ENV: 'production' }), s3), Error, 'OPENAI_API_KEY');
  assertThrows(() => selectProvider(env({ APP_ENV: 'production', OPENAI_API_KEY: 'k' }), s3), Error, 'stand-in');
  assertThrows(() => selectProvider(env({ OPENAI_API_KEY: 'k', CSAM_MATCHER: 'nope' }), s3), Error, 'unknown');
});

// ---------------------------------------------------------------- OpenAI adapters against a stand-in
Deno.test('adapters: request shape, parsing and errors against a local stand-in', async () => {
  const bodies: Record<string, unknown>[] = [];
  let status = 200;
  const server = Deno.serve({ port: 0, hostname: '127.0.0.1', onListen: () => {} }, async (req) => {
    bodies.push({ path: new URL(req.url).pathname, auth: req.headers.get('authorization'), ...(await req.json()) });
    if (status !== 200) return new Response('{}', { status });
    if (new URL(req.url).pathname === '/v1/moderations') {
      return Response.json({ model: 'omni-moderation-2024-09-26', results: [{ category_scores: { sexual: 0.42 } }] });
    }
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ verdict: 'remove', reason: 'Nudity.' }) } }],
    });
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.addr.port}`;
    const mod = openAIModeration({ apiKey: 'test-key', baseUrl, model: 'omni-moderation-latest' });
    assertEquals(await mod.scoreImage(THUMB, 'cap'), { model: 'omni-moderation-2024-09-26', scores: { sexual: 0.42 } });
    const sent = bodies[0] as {
      path: string;
      auth: string;
      model: string;
      input: { type: string; image_url?: { url: string } }[];
    };
    assertEquals([sent.path, sent.auth, sent.model], ['/v1/moderations', 'Bearer test-key', 'omni-moderation-latest']);
    assertEquals(sent.input.map((i) => i.type), ['text', 'image_url']);
    assert(sent.input[1].image_url!.url.startsWith('data:image/jpeg;base64,'), 'the image goes as a data URL');
    await mod.scoreText('hello');
    assertEquals((bodies[1] as { input: unknown[] }).input, [{ type: 'text', text: 'hello' }]);

    const vision = openAISecondOpinion({ apiKey: 'test-key', baseUrl, model: 'gpt-4.1-mini' });
    assertEquals(await vision.ask(THUMB, null, 'sexual'), {
      model: 'gpt-4.1-mini',
      verdict: 'remove',
      reason: 'Nudity.',
    });

    status = 429;
    await assertRejects(() => mod.scoreText('x'), Error, '429');
  } finally {
    await server.shutdown();
  }
});

// ---------------------------------------------------------------- the handler against the local stack
let owner: TestUser, reader: TestUser;
let db: Awaited<ReturnType<typeof admin>>;
let jarId: string;

async function sql(query: string): Promise<void> {
  const out = await new Deno.Command('docker', {
    args: ['exec', 'supabase_db_pickld', 'psql', '-U', 'postgres', '-At', '-c', query],
    stdout: 'null',
    stderr: 'piped',
  }).output();
  if (!out.success) throw new Error(`psql failed: ${new TextDecoder().decode(out.stderr)}`);
}

const blocker: ModerationProvider = {
  name: 'stub-block',
  check: () => Promise.resolve({ decision: 'block', matcher: 'stub', match: { list: 'test' } }),
  checkText: () => Promise.resolve({ decision: 'approve' }),
};

Deno.test('setup (local stack)', async () => {
  owner = await createUser('csam_owner');
  reader = await createUser('csam_reader');
  db = await admin();
  await insert('follows', { reader_id: reader.id, author_id: owner.id });
  jarId = (await insert<{ id: string }>('jars', {
    user_id: owner.id,
    local_date: localDate(),
    tz: 'Asia/Manila',
    visibility: 'readers',
    published_at: new Date().toISOString(),
  })).id;
});

Deno.test('a match: answered as removed, owner suspended, incident recorded, nothing queued', async () => {
  const id = crypto.randomUUID();
  const photo = `moments/${owner.id}/${id}/full.jpg`;
  const live = crypto.randomUUID();
  // A live moment from before: it must disappear for readers too once the owner is suspended.
  await userClient(owner.jwt).from('moments').insert({
    id: live,
    jar_id: jarId,
    user_id: owner.id,
    slot: 'morning',
    status: 'checking',
    photo_path: `moments/${owner.id}/${live}/full.jpg`,
    thumb_path: `moments/${owner.id}/${live}/thumb.jpg`,
  });
  const res0 = await handleModerate(request('moderate', { jwt: owner.jwt, body: { momentId: live } }), {
    userClient,
    serviceClient: () => db,
    provider: { ...blocker, check: () => Promise.resolve({ decision: 'approve' }) },
  });
  assertEquals(res0.status, 200);
  assertEquals((await userClient(reader.jwt).from('moments').select('id').eq('id', live)).data?.length, 1);

  const { error } = await userClient(owner.jwt).from('moments').insert({
    id,
    jar_id: jarId,
    user_id: owner.id,
    slot: 'evening',
    status: 'checking',
    photo_path: photo,
    thumb_path: photo.replace('full', 'thumb'),
  });
  if (error) throw new Error(error.message);
  const res = await handleModerate(request('moderate', { jwt: owner.jwt, body: { momentId: id } }), {
    userClient,
    serviceClient: () => db,
    provider: blocker,
  });
  assertEquals(res.status, 200);
  assertEquals((await res.json()).data, { momentId: id, outcome: 'removed', status: 'removed' });

  assertEquals((await db.from('profiles').select('status').eq('id', owner.id).single()).data?.status, 'suspended');
  const incidents =
    (await db.from('csam_incidents').select('moment_id, photo_path, matcher').eq('user_id', owner.id)).data;
  assertEquals(incidents, [{ moment_id: id, photo_path: photo, matcher: 'stub' }]);
  assertEquals((await db.from('moderation_items').select('id').eq('moment_id', id)).data, []);
  assertEquals(
    (await userClient(reader.jwt).from('moments').select('id').eq('id', live)).data,
    [],
    'readers no longer see anything the owner posted',
  );
});

Deno.test('cleanup (local stack)', async () => {
  await sql(`delete from public.csam_incidents where user_id = '${owner.id}'`);
  await cleanup();
});
