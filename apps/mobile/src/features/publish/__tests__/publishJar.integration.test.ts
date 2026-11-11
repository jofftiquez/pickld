/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../lib/database.types';
import { localDateIn } from '../../../lib/jars';
import { nodeFetch } from '../../../lib/queue/__tests__/nodeFetch';
import { PublishError, publishJar } from '../publishJar';

// Publish review (M3-01; FR-PUB-01, FR-PUB-02, FR-PUB-03) against the local stack: the real jars trigger
// (0003), can_view_jar and RLS, and fn:moderate for live moments. Checked as owner, reader, outsider and
// blocked user. Skipped unless PICKLD_INTEGRATION=1; needs `pnpm db:start` and Edge Functions served with
// supabase/functions/.env (see uploader.integration.test.ts). Keys come from `supabase status` at runtime.
//
//   cd apps/mobile && PICKLD_INTEGRATION=1 npx jest publishJar.integration

const enabled = process.env.PICKLD_INTEGRATION === '1';
const describeLocal = enabled ? describe : describe.skip;

const TZ = 'Asia/Manila';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
type Status = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
type User = { id: string; client: SupabaseClient<Database> };

describeLocal('Publish jar against local Supabase', () => {
  let env: Status;
  let admin: SupabaseClient<Database>;
  const people: string[] = [];

  async function signedInUser(name: string): Promise<User> {
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

  /** Today's jar with a live public #ootd and a live private #selfie, approved by the real fn:moderate. */
  async function jarWithMoments(owner: User) {
    const { data: jar, error } = await owner.client.rpc('ensure_jar', {
      local_date: localDateIn(new Date(), TZ),
      tz: TZ,
    });
    if (error) throw new Error(`ensure_jar: ${error.message}`);
    for (const [slot, isPrivate] of [
      ['ootd', false],
      ['selfie', true],
    ] as const) {
      const { data: row, error: insertError } = await owner.client
        .from('moments')
        .insert({
          jar_id: jar.id,
          user_id: owner.id,
          slot,
          photo_path: `seed/photos/${slot}.jpg`,
          thumb_path: `seed/thumbs/${slot}.jpg`,
          is_private: isPrivate,
          status: 'checking',
        })
        .select('id')
        .single();
      if (insertError) throw new Error(`insert: ${insertError.message}`);
      await owner.client.functions.invoke('moderate', { body: { momentId: row.id } });
    }
    return jar.id;
  }

  /** What `viewer` can read of the jar: the jar row and the slots of its moments, as RLS allows. */
  async function seenBy(viewer: User, jarId: string) {
    const { data: jars } = await viewer.client.from('jars').select('id').eq('id', jarId);
    const { data: moments } = await viewer.client.from('moments').select('slot').eq('jar_id', jarId).order('slot');
    return { jar: (jars ?? []).length === 1, slots: (moments ?? []).map((m) => m.slot) };
  }

  const stamp = async (jarId: string) =>
    (await admin.from('jars').select('visibility, published_at').eq('id', jarId).single()).data;

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

  it('owner, reader, outsider and blocked reader: publishing shares only what each may see', async () => {
    const owner = await signedInUser('author');
    const reader = await signedInUser('reader');
    const outsider = await signedInUser('outsider');
    const blocked = await signedInUser('blocked');
    await admin.from('follows').insert([
      { reader_id: reader.id, author_id: owner.id },
      { reader_id: blocked.id, author_id: owner.id },
    ]);
    await admin.from('blocks').insert({ blocker_id: owner.id, blocked_id: blocked.id });
    const jarId = await jarWithMoments(owner);

    // Unpublished: only the owner sees it (FR-PUB-02).
    expect(await seenBy(owner, jarId)).toEqual({ jar: true, slots: ['ootd', 'selfie'] });
    for (const viewer of [reader, outsider, blocked])
      expect(await seenBy(viewer, jarId)).toEqual({ jar: false, slots: [] });

    // Readers: the reader sees the jar and the public moment, never the private one.
    const before = Date.now();
    const publishedAt = await publishJar(owner.client, jarId, 'readers');
    expect(await stamp(jarId)).toEqual({ visibility: 'readers', published_at: publishedAt });
    expect(Math.abs(new Date(publishedAt).getTime() - before)).toBeLessThan(60_000);
    expect(await seenBy(reader, jarId)).toEqual({ jar: true, slots: ['ootd'] });
    expect(await seenBy(outsider, jarId)).toEqual({ jar: false, slots: [] });
    expect(await seenBy(blocked, jarId)).toEqual({ jar: false, slots: [] });

    // Everyone: outsiders too, still not the blocked user; the first publish time stays.
    expect(await publishJar(owner.client, jarId, 'everyone')).toBe(publishedAt);
    expect(await seenBy(outsider, jarId)).toEqual({ jar: true, slots: ['ootd'] });
    expect(await seenBy(blocked, jarId)).toEqual({ jar: false, slots: [] });

    // Only me: back to the owner alone.
    await publishJar(owner.client, jarId, 'only_me');
    expect(await seenBy(reader, jarId)).toEqual({ jar: false, slots: [] });
    expect(await seenBy(outsider, jarId)).toEqual({ jar: false, slots: [] });
    expect(await seenBy(owner, jarId)).toEqual({ jar: true, slots: ['ootd', 'selfie'] });
  });

  it('another user can’t publish the jar: refused, and nothing changes', async () => {
    const owner = await signedInUser('author');
    const reader = await signedInUser('reader');
    await admin.from('follows').insert({ reader_id: reader.id, author_id: owner.id });
    const jarId = await jarWithMoments(owner);

    const outcome = await publishJar(reader.client, jarId, 'everyone').then(
      () => 'ok',
      (error: unknown) => (error instanceof PublishError ? error.reason : `unexpected ${String(error)}`),
    );
    expect(outcome).toBe('refused');
    expect(await stamp(jarId)).toEqual({ visibility: 'readers', published_at: null });
  });
});
