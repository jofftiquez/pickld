/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../database.types';
import { queueTarget } from '../../../features/capture/saveCapture';
import { fillTarget } from '../../../features/capture/fillTarget';
import { localDateIn } from '../../jars';
import { enqueue, getItem, listQueue } from '../store';
import { drainQueue, type PutFile } from '../uploader';
import { capturedFiles, files, resetFakes } from './fakes';

// M2-04 against the local stack: ensure_jar, fn:upload-url, the local S3 bucket (D-22) and the moments
// table with its real unique (jar_id, slot). Skipped unless PICKLD_INTEGRATION=1. Needs `pnpm db:start`
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

// jest-expo swaps the global fetch for a stub even in the node environment, so this test talks HTTP
// through node:http (local Supabase is plain http).
const nodeFetch = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> =>
  new Promise((resolveResponse, reject) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const req = request(url, { method: init.method ?? 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const status = res.statusCode ?? 500;
        const body = status === 204 || status === 304 ? null : Buffer.concat(chunks);
        const out = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (value !== undefined) out.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        resolveResponse(new Response(body, { status, headers: out }));
      });
    });
    req.on('error', reject);
    if (init.body !== undefined && init.body !== null) req.write(init.body as string | Buffer);
    req.end();
  });

describeLocal('upload worker against local Supabase', () => {
  let admin: SupabaseClient<Database>;
  let client: SupabaseClient<Database>;
  let userId = '';

  beforeAll(async () => {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: resolve(__dirname, '../../../../../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(out.slice(out.indexOf('{'))) as Status;
    admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { ...noSession, global: { fetch: nodeFetch } });
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
      .select('slot, is_backfilled, jars(local_date, tz)')
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
