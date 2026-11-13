/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../lib/database.types';
import { localDateIn } from '../../../lib/jars';
import { nodeFetch } from '../../../lib/queue/__tests__/nodeFetch';
import type { PutFile } from '../../../lib/queue/uploader';
import {
  deleteMoment,
  MomentOptionError,
  moveMoment,
  saveMomentEdits,
  saveRecrop,
  setMomentVisibility,
  type MomentTarget,
} from '../momentActions';

// Moment options (M2-23) on uploaded moments, against the local stack: the real moments triggers and
// one-moment-per-slot index (0004, 0013), RLS, fn:upload-url, the local S3 bucket (D-22) and the real
// fn:moderate. Skipped unless PICKLD_INTEGRATION=1; needs `pnpm db:start` and Edge Functions served with
// supabase/functions/.env (see uploader.integration.test.ts). Keys come from `supabase status` at runtime.
//
//   cd apps/mobile && PICKLD_INTEGRATION=1 npx jest momentActions.integration

jest.mock('expo-file-system', () => jest.requireActual('../../../lib/queue/__tests__/fakes').expoFileSystem);
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn(async () => undefined) }));

const enabled = process.env.PICKLD_INTEGRATION === '1';
const describeLocal = enabled ? describe : describe.skip;

const TZ = 'Asia/Manila';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
type Status = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };

/** Local files for the re-cropped photo: URI → bytes. */
const localFiles = new Map<string, string>();
const putFile: PutFile = async (fileUri, target) => {
  const data = localFiles.get(fileUri);
  if (data === undefined) throw new Error(`no local file ${fileUri}`);
  const res = await nodeFetch(target.url, { method: target.method, headers: target.headers, body: Buffer.from(data) });
  if (!res.ok) throw new Error(`PUT answered ${res.status}`);
};
const sizeOf = (uri: string) => Buffer.byteLength(localFiles.get(uri) ?? '');

describeLocal('Moment options against local Supabase', () => {
  let env: Status;
  let admin: SupabaseClient<Database>;
  const people: string[] = [];

  async function signedInUser(name: string): Promise<{ id: string; client: SupabaseClient<Database> }> {
    const suffix = Math.random().toString(36).slice(2, 10);
    const email = `${name}-${suffix}@jesttest.pickld.test`;
    const password = `${Math.random().toString(36)}${Math.random().toString(36)}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    people.push(data.user.id);
    await admin.from('profiles').insert({
      id: data.user.id,
      username: `${name.slice(0, 2)}_${suffix}`,
      display_name: name,
      birthday: '1995-05-05',
    });
    const client = createClient<Database>(env.API_URL, env.ANON_KEY, { ...noSession, global: { fetch: nodeFetch } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`sign in: ${signInError.message}`);
    return { id: data.user.id, client };
  }

  /** Today's jar with live moments in `slots`, made as the owner and approved by the real fn:moderate. */
  async function jarWith(
    owner: { id: string; client: SupabaseClient<Database> },
    slots: Database['public']['Enums']['slot'][],
  ) {
    const { data: jar, error } = await owner.client.rpc('ensure_jar', {
      local_date: localDateIn(new Date(), TZ),
      tz: TZ,
    });
    if (error) throw new Error(`ensure_jar: ${error.message}`);
    const ids: Record<string, string> = {};
    for (const slot of slots) {
      const { data: row, error: insertError } = await owner.client
        .from('moments')
        .insert({
          jar_id: jar.id,
          user_id: owner.id,
          slot,
          photo_path: `seed/photos/${slot}.jpg`,
          thumb_path: `seed/thumbs/${slot}.jpg`,
          caption: `old ${slot}`,
          status: 'checking',
        })
        .select('id')
        .single();
      if (insertError) throw new Error(`insert: ${insertError.message}`);
      await owner.client.functions.invoke('moderate', { body: { momentId: row.id } });
      ids[slot] = row.id;
    }
    return { jarId: jar.id, ids };
  }

  const read = async (id: string) =>
    (
      await admin
        .from('moments')
        .select('slot, status, caption, edits, visibility, photo_path, thumb_path, pending_since')
        .eq('id', id)
        .maybeSingle()
    ).data;

  const reason = (promise: Promise<unknown>) =>
    promise.then(
      () => 'ok',
      (error: unknown) => (error instanceof MomentOptionError ? error.reason : `unexpected ${String(error)}`),
    );

  beforeAll(() => {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: resolve(__dirname, '../../../../../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    env = JSON.parse(out.slice(out.indexOf('{'))) as Status;
    admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, { ...noSession, global: { fetch: nodeFetch } });
  });

  afterAll(async () => {
    for (const id of people) await admin.auth.admin.deleteUser(id); // jars and moments cascade
  });

  it('Move goes to an empty slot; a filled slot is refused and nothing changes', async () => {
    const owner = await signedInUser('mover');
    const { jarId, ids } = await jarWith(owner, ['ootd', 'selfie']);
    const ootd: MomentTarget = { kind: 'server', momentId: ids.ootd ?? '', jarId };

    await moveMoment(owner.client, ootd, 'evening');
    expect(await read(ids.ootd ?? '')).toMatchObject({ slot: 'evening', status: 'live', caption: 'old ootd' });

    expect(await reason(moveMoment(owner.client, ootd, 'selfie'))).toBe('slotTaken');
    expect(await read(ids.ootd ?? '')).toMatchObject({ slot: 'evening' });
    expect(await read(ids.selfie ?? '')).toMatchObject({ slot: 'selfie' });
  }, 60_000);

  it('Only me hides it from the jar’s visible count at once; Delete removes it and recounts', async () => {
    const owner = await signedInUser('hider');
    const { jarId, ids } = await jarWith(owner, ['morning', 'afternoon']);
    const counts = async () =>
      (await admin.from('jars').select('moment_count, visible_count').eq('id', jarId).single()).data;
    expect(await counts()).toEqual({ moment_count: 2, visible_count: 2 });

    await setMomentVisibility(owner.client, { kind: 'server', momentId: ids.morning ?? '', jarId }, 'only_me');
    expect(await read(ids.morning ?? '')).toMatchObject({ visibility: 'only_me', status: 'live', pending_since: null });
    expect(await counts()).toEqual({ moment_count: 2, visible_count: 1 });

    const afternoon: MomentTarget = { kind: 'server', momentId: ids.afternoon ?? '', jarId };
    await deleteMoment(owner.client, afternoon);
    expect(await read(ids.afternoon ?? '')).toBeNull();
    expect(await counts()).toEqual({ moment_count: 1, visible_count: 0 });
    // Deleting it again: nothing left to delete.
    expect(await reason(deleteMoment(owner.client, afternoon))).toBe('refused');
  }, 60_000);

  it('another user can’t move, hide or delete the moment (RLS)', async () => {
    const owner = await signedInUser('owner');
    const outsider = await signedInUser('outsider');
    const { jarId, ids } = await jarWith(owner, ['whereami']);
    const target: MomentTarget = { kind: 'server', momentId: ids.whereami ?? '', jarId };

    expect(await reason(moveMoment(outsider.client, target, 'evening'))).toBe('refused');
    expect(await reason(setMomentVisibility(outsider.client, target, 'only_me'))).toBe('refused');
    expect(await reason(deleteMoment(outsider.client, target))).toBe('refused');
    expect(await read(ids.whereami ?? '')).toMatchObject({ slot: 'whereami', visibility: 'readers', status: 'live' });
  }, 60_000);

  it('Edit caption, stickers and filters: the proposal goes live through fn:moderate, visibility at once', async () => {
    const owner = await signedInUser('editor');
    const { jarId, ids } = await jarWith(owner, ['mebusywith']);
    const edits = { v: 1, filter: 'mono', overlays: [] };

    await saveMomentEdits(
      owner.client,
      { kind: 'server', momentId: ids.mebusywith ?? '', jarId },
      {
        caption: 'new caption',
        visibility: 'only_me',
        edits,
      },
    );
    expect(await read(ids.mebusywith ?? '')).toMatchObject({
      caption: 'new caption',
      edits,
      visibility: 'only_me',
      status: 'live',
      pending_since: null,
      photo_path: 'seed/photos/mebusywith.jpg',
    });
  }, 60_000);

  it('Re-crop uploads the new photo and swaps it in through fn:moderate; the moment keeps its id and caption', async () => {
    const owner = await signedInUser('cropper');
    const { jarId, ids } = await jarWith(owner, ['whoamiwith']);
    localFiles.set('file:///cache/recrop.webp', 'webp:recropped-full');
    localFiles.set('file:///cache/recrop-thumb.webp', 'webp:recropped-thumb');

    await saveRecrop(
      owner.client,
      { kind: 'server', momentId: ids.whoamiwith ?? '', jarId },
      { photoUri: 'file:///cache/recrop.webp', thumbUri: 'file:///cache/recrop-thumb.webp' },
      { putFile, sizeOf },
    );
    const after = await read(ids.whoamiwith ?? '');
    expect(after).toMatchObject({ status: 'live', caption: 'old whoamiwith', pending_since: null });
    expect(after?.photo_path).not.toBe('seed/photos/whoamiwith.jpg');
    const { data: photo } = await admin.storage.from('photos').download(after?.photo_path ?? '');
    expect(photo?.size).toBe(Buffer.byteLength('webp:recropped-full'));
    const { data: thumb } = await admin.storage.from('photos').download(after?.thumb_path ?? '');
    expect(thumb?.size).toBe(Buffer.byteLength('webp:recropped-thumb'));
  }, 60_000);
});
