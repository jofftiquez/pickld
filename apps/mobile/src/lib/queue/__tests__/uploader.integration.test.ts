/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../database.types';
import { queueTarget } from '../../../features/capture/saveCapture';
import { fillTarget } from '../../../features/capture/fillTarget';
import { localDateIn } from '../../jars';
import { enqueue, getItem, listQueue, replaceItem } from '../store';
import { drainQueue, type PutFile, type UploaderClient } from '../uploader';
import { capturedFiles, files, resetFakes } from './fakes';
import { nodeFetch } from './nodeFetch';

// M2-04 against the local stack: ensure_jar, fn:upload-url, the local S3 bucket (D-22) and the moments
// table with its real one-moment-per-slot index (0013), and Replace (M2-22) through the real fn:moderate. Skipped unless PICKLD_INTEGRATION=1. Needs `pnpm db:start`
// with migrations applied, Edge Functions served with supabase/functions/.env filled in (S3_* values from
// `supabase status -o env`). Keys are read at runtime from `supabase status`; nothing is stored here.
// The queue itself still runs on the node:sqlite and in-memory file fakes; only the network is real.
//
//   cd apps/mobile && PICKLD_INTEGRATION=1 npx jest uploader.integration

jest.mock('expo-sqlite', () => jest.requireActual('./fakes').expoSqlite);
jest.mock('expo-file-system', () => jest.requireActual('./fakes').expoFileSystem);
// saveCapture (for queueTarget) loads Sentry (ESM) through monitoring.
jest.mock('../../monitoring', () => ({ captureError: jest.fn() }));

const enabled = process.env.PICKLD_INTEGRATION === '1';
const describeLocal = enabled ? describe : describe.skip;

interface Status {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
}

const TZ = 'Asia/Manila';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** PUTs the fake file's bytes with Node's fetch, sending exactly the signed headers. */
const putFile: PutFile = async (fileUri, target) => {
  const data = files.get(fileUri);
  if (data === undefined) throw new Error(`no local file ${fileUri}`);
  const res = await nodeFetch(target.url, { method: target.method, headers: target.headers, body: Buffer.from(data) });
  if (!res.ok) throw new Error(`photo upload answered ${res.status}: ${await res.text()}`);
};

describeLocal('upload worker against local Supabase', () => {
  let admin: SupabaseClient<Database>;
  let client: SupabaseClient<Database>;
  let userId = '';
  let env: Status;

  beforeAll(async () => {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: resolve(__dirname, '../../../../../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(out.slice(out.indexOf('{'))) as Status;
    env = status;
    admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, {
      ...noSession,
      global: { fetch: nodeFetch },
    });
    client = createClient<Database>(status.API_URL, status.ANON_KEY, { ...noSession, global: { fetch: nodeFetch } });

    const suffix = Math.random().toString(36).slice(2, 10);
    const email = `uploader-${suffix}@jesttest.pickld.test`;
    const password = `${Math.random().toString(36)}${Math.random().toString(36)}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    userId = data.user.id;
    const { error: profileError } = await admin
      .from('profiles')
      .insert({ id: userId, username: `u_${suffix}`, display_name: 'Uploader', birthday: '1995-05-05' });
    if (profileError) throw new Error(`profile: ${profileError.message}`);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`sign in: ${signInError.message}`);
  }, 60_000);

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId); // jars and moments cascade
  });

  beforeEach(() => resetFakes());

  it('uploads a queued moment and moderate makes it live, then reports a second one for the slot as a conflict', async () => {
    const localDate = localDateIn(new Date(), TZ);
    const first = await enqueue({ userId, ...capturedFiles('first'), slot: 'ootd', localDate, tz: TZ });

    const [uploaded] = await drainQueue(userId, { client, putFile });
    expect(uploaded).toMatchObject({ kind: 'uploaded', itemId: first.id });
    if (uploaded?.kind !== 'uploaded') return;

    const { data: moment, error } = await client
      .from('moments')
      .select('id, slot, status, photo_path, thumb_path, is_backfilled')
      .eq('id', uploaded.momentId)
      .single();
    expect(error).toBeNull();
    // fn:moderate auto-approves (D-22) and may already have run.
    expect(moment).toMatchObject({
      slot: 'ootd',
      is_backfilled: false,
      status: 'live',
    });
    const { data: photo } = await admin.storage.from('photos').download(moment?.photo_path ?? '');
    expect(photo?.size).toBe(Buffer.byteLength('jpeg:first:full-resolution-bytes'));
    expect(await getItem(first.id)).toBeNull();
    expect([...files.keys()].filter((uri) => uri.startsWith('file:///docs/queue/'))).toEqual([]);

    const second = await enqueue({ userId, ...capturedFiles('second'), slot: 'ootd', localDate, tz: TZ });
    const [outcome] = await drainQueue(userId, { client, putFile });
    expect(outcome).toEqual({ kind: 'conflict', itemId: second.id, jarId: expect.any(String), slot: 'ootd' });
    expect(await listQueue(userId)).toEqual([
      expect.objectContaining({ id: second.id, state: 'conflict', attempts: 0 }),
    ]);
  }, 60_000);

  it('Replace (M2-22): a reader sees the old photo until fn:moderate approves the new one, then only the new one', async () => {
    // A reader who follows the user, signed in with their own client: RLS decides what they see.
    const suffix = Math.random().toString(36).slice(2, 10);
    const email = `reader-${suffix}@jesttest.pickld.test`;
    const password = `${Math.random().toString(36)}${Math.random().toString(36)}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) throw new Error(`createUser: ${createError?.message}`);
    const readerId = created.user.id;
    try {
      await admin
        .from('profiles')
        .insert({ id: readerId, username: `r_${suffix}`, display_name: 'Reader', birthday: '1995-05-05' });
      await admin.from('follows').insert({ reader_id: readerId, author_id: userId });
      const reader = createClient<Database>(env.API_URL, env.ANON_KEY, { ...noSession, global: { fetch: nodeFetch } });
      const { error: signInError } = await reader.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(`reader sign in: ${signInError.message}`);
      const readerSees = async (jarId: string) =>
        (await reader.from('moments').select('id, photo_path').eq('jar_id', jarId).eq('slot', 'whoamiwith')).data ?? [];

      const localDate = localDateIn(new Date(), TZ);
      await enqueue({ userId, ...capturedFiles('old'), slot: 'whoamiwith', localDate, tz: TZ });
      const [first] = await drainQueue(userId, { client, putFile });
      if (first?.kind !== 'uploaded') throw new Error(`first upload: ${JSON.stringify(first)}`);
      const { data: jar } = await client.from('moments').select('jar_id').eq('id', first.momentId).single();
      const jarId = jar?.jar_id ?? '';
      await client
        .from('jars')
        .update({ visibility: 'readers', published_at: new Date().toISOString() })
        .eq('id', jarId);
      const old = await readerSees(jarId);
      const countOf = async () =>
        (await client.from('jars').select('moment_count').eq('id', jarId).single()).data?.moment_count;
      const countBefore = await countOf();
      expect(old).toEqual([{ id: first.momentId, photo_path: expect.any(String) }]);

      // A new photo for the filled slot ends as a conflict; Replace queues it again as a replacement.
      const second = await enqueue({ userId, ...capturedFiles('new'), slot: 'whoamiwith', localDate, tz: TZ });
      const [conflicted] = await drainQueue(userId, { client, putFile });
      expect(conflicted).toMatchObject({ kind: 'conflict', itemId: second.id });
      await replaceItem(second.id);

      // fn:moderate doesn't answer this time, as if it were slow: the replacement is in, hidden, and the
      // reader still sees only the old photo.
      const holdModerate = {
        rpc: client.rpc.bind(client),
        from: client.from.bind(client),
        functions: {
          invoke: (name: string, options: { body: Record<string, unknown> }) =>
            name === 'moderate'
              ? Promise.resolve({ data: null, error: new Error('held for the test') })
              : client.functions.invoke(name, options),
        },
      } as unknown as UploaderClient;
      const [held] = await drainQueue(userId, { client: holdModerate, putFile });
      expect(held).toMatchObject({ kind: 'retrying', itemId: second.id });
      const newId = (await getItem(second.id))?.momentId ?? '';
      const { data: pending } = await client.from('moments').select('status, replaces').eq('id', newId).single();
      expect(pending).toEqual({ status: 'checking', replaces: first.momentId });
      expect(await readerSees(jarId)).toEqual(old);
      expect(await countOf()).toBe(countBefore); // the pending replacement doesn't count

      // fn:moderate approves (D-22): the old moment is gone and the reader sees the new photo.
      const { error: moderateError } = await client.functions.invoke('moderate', { body: { momentId: newId } });
      expect(moderateError).toBeNull();
      const after = await readerSees(jarId);
      expect(after).toEqual([{ id: newId, photo_path: expect.any(String) }]);
      expect(after[0]?.photo_path).not.toBe(old[0]?.photo_path);
      const { data: oldRow } = await admin.from('moments').select('id').eq('id', first.momentId).maybeSingle();
      expect(oldRow).toBeNull();
      expect(await countOf()).toBe(countBefore); // the slot still counts once

      // The queue's retry finds the moment already live and finishes: the local files go.
      const [done] = await drainQueue(userId, { client, putFile, now: () => Date.now() + 60_000 });
      expect(done).toMatchObject({ kind: 'uploaded', itemId: second.id, momentId: newId });
      expect(await getItem(second.id)).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(readerId);
    }
  }, 90_000);

  it('Fill this jar: a moment queued for a past date lands in that date’s jar with Added later (M2-26)', async () => {
    const now = new Date();
    const today = localDateIn(now, TZ);
    const past = localDateIn(new Date(now.getTime() - 3 * 86_400_000), TZ);
    // The camera's path: no jar for that day yet, so the phone zone; the open jar is today's.
    const target = queueTarget({ tz: TZ, shotAt: now, openJar: null, fill: fillTarget(past, null, TZ) });
    expect(target).toMatchObject({ localDate: past, tz: TZ });
    const item = await enqueue({ userId, ...capturedFiles('fill'), slot: 'selfie', ...target });

    const [uploaded] = await drainQueue(userId, { client, putFile });
    expect(uploaded).toMatchObject({ kind: 'uploaded', itemId: item.id });
    if (uploaded?.kind !== 'uploaded') return;
    const { data: moment, error } = await client
      .from('moments')
      .select('slot, is_backfilled, jars!moments_jar_id_fkey(local_date, tz)')
      .eq('id', uploaded.momentId)
      .single();
    expect(error).toBeNull();
    expect(moment).toMatchObject({ slot: 'selfie', is_backfilled: true, jars: { local_date: past, tz: TZ } });

    // A future date is refused by the server too (the app never sends one: parseFillDateParam).
    const tomorrow = localDateIn(new Date(now.getTime() + 2 * 86_400_000), TZ);
    expect(tomorrow > today).toBe(true);
    const { error: futureError } = await client.rpc('ensure_jar', { local_date: tomorrow, tz: TZ });
    expect(futureError?.message).toMatch(/future/);
  }, 60_000);
});
