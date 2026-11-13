/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../lib/database.types';
import { localDateIn } from '../../../lib/jars';
import { nodeFetch } from '../../../lib/queue/__tests__/nodeFetch';
import { deleteComment, fetchComments, postComment } from '../useComments';

// Comments (M3-11; moment threads 0068) against the local stack: the app's own postComment / fetchComments / deleteComment
// with RLS (0001 comments_select), the hidden-on-insert trigger (0005) and the real fn:moderate text path
// (0016; D-22 auto-pass). Skipped unless PICKLD_INTEGRATION=1; needs `pnpm db:start` and Edge Functions
// served with supabase/functions/.env. Keys come from `supabase status` at runtime.
//
//   cd apps/mobile && PICKLD_INTEGRATION=1 npx jest comments.integration

let mockClient: SupabaseClient<Database> | null = null;
jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));

const enabled = process.env.PICKLD_INTEGRATION === '1';
const describeLocal = enabled ? describe : describe.skip;

const TZ = 'Asia/Manila';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
type Status = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
type User = { id: string; client: SupabaseClient<Database> };

describeLocal('Comments against local Supabase', () => {
  let env: Status;
  let admin: SupabaseClient<Database>;
  const people: string[] = [];
  let owner: User, reader: User, outsider: User;
  let jarId: string;

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

  /** Runs the app code as `user`. */
  const as = <T>(user: User, run: () => Promise<T>) => {
    mockClient = user.client;
    return run();
  };
  const ids = async (user: User) => (await as(user, () => fetchComments(jarId))).map((c) => c.id);

  beforeAll(async () => {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: resolve(__dirname, '../../../../../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    env = JSON.parse(out.slice(out.indexOf('{'))) as Status;
    admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, { ...noSession, global: { fetch: nodeFetch } });
    owner = await signedInUser('owner');
    reader = await signedInUser('reader');
    outsider = await signedInUser('outsider');
    await admin.from('follows').insert({ reader_id: reader.id, author_id: owner.id });
    const { data: jar, error } = await owner.client.rpc('ensure_jar', {
      local_date: localDateIn(new Date(), TZ),
      tz: TZ,
    });
    if (error) throw new Error(`ensure_jar: ${error.message}`);
    jarId = jar.id;
    const published = await owner.client
      .from('jars')
      .update({ visibility: 'readers', published_at: new Date().toISOString() })
      .eq('id', jarId);
    if (published.error) throw new Error(`publish: ${published.error.message}`);
  }, 60_000);

  afterAll(async () => {
    for (const id of people) await admin.auth.admin.deleteUser(id);
  });

  it('a pending comment is visible to its author only; once checked, readers of the jar see it', async () => {
    // Saved without the check: the moderate call is what makes it visible.
    const { data, error } = await reader.client
      .from('comments')
      .insert({ jar_id: jarId, user_id: reader.id, body: 'pending one' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    expect(await ids(reader)).toContain(data.id);
    expect(await ids(owner)).not.toContain(data.id);

    const posted = await as(reader, () => postComment(jarId, reader.id, 'Love the light', null));
    expect(await ids(owner)).toContain(posted);
    expect(await ids(outsider)).toEqual([]);
    const [mine] = (await as(reader, () => fetchComments(jarId))).filter((c) => c.id === posted);
    expect(mine).toMatchObject({ is_hidden: false, author: { display_name: 'reader' } });
  }, 60_000);

  it('a reply joins its comment, and the jar owner can delete it', async () => {
    const parent = await as(reader, () => postComment(jarId, reader.id, 'Top level', null));
    const reply = await as(owner, () => postComment(jarId, owner.id, 'Thanks!', parent));
    await expect(as(reader, () => postComment(jarId, reader.id, 'Too deep', reply))).rejects.toThrow(/one level/);
    await expect(as(outsider, () => deleteComment(parent))).rejects.toThrow();
    await as(owner, () => deleteComment(parent));
    expect(await ids(reader)).not.toContain(parent);
  }, 60_000);

  it('a moment has its own thread, counted on the moment and not on the jar (0068)', async () => {
    const { data: m, error } = await owner.client
      .from('moments')
      .insert({
        jar_id: jarId,
        user_id: owner.id,
        slot: 'morning',
        photo_path: 'seed/photos/morning.jpg',
        thumb_path: 'seed/thumbs/morning.jpg',
        visibility: 'readers',
        status: 'checking',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    await owner.client.functions.invoke('moderate', { body: { momentId: m.id } });
    const jarCount = async () =>
      (await admin.from('jars').select('comment_count').eq('id', jarId).single()).data?.comment_count;
    const before = await jarCount();

    const posted = await as(reader, () => postComment(jarId, reader.id, 'That light', null, m.id));
    const thread = (await as(owner, () => fetchComments(jarId, m.id))).map((c) => c.id);
    expect(thread).toEqual([posted]);
    expect(await ids(owner)).not.toContain(posted);
    await expect(as(outsider, () => postComment(jarId, outsider.id, 'Hi', null, m.id))).rejects.toThrow();
    const moment = await admin.from('moments').select('comment_count').eq('id', m.id).single();
    expect(moment.data?.comment_count).toBe(1);
    expect(await jarCount()).toBe(before);
  }, 60_000);
});
