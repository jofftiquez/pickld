/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../lib/database.types';
import { nodeFetch } from '../../../lib/queue/__tests__/nodeFetch';
import { removeReader, setReading } from '../useFollow';
import { fetchFollowList } from '../useFollowList';
import { fetchProfile } from '../useProfile';

// Read, Reading and Remove reader (M3-14) against the local stack: the app's own setReading /
// removeReader / fetchFollowList / fetchProfile with RLS (follows_insert/delete, 0001; 0005), follows_sync
// keeping both profiles' counts, and search_follow_list (0017). Skipped unless PICKLD_INTEGRATION=1;
// needs `pnpm db:start`. Keys come from `supabase status` at runtime.
//
//   cd apps/mobile && PICKLD_INTEGRATION=1 npx jest follows.integration

let mockClient: SupabaseClient<Database> | null = null;
jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));

const enabled = process.env.PICKLD_INTEGRATION === '1';
const describeLocal = enabled ? describe : describe.skip;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
type Status = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
type User = { id: string; username: string; client: SupabaseClient<Database> };

describeLocal('Follows against local Supabase', () => {
  let env: Status;
  let admin: SupabaseClient<Database>;
  const people: string[] = [];
  let author: User, reader: User, stranger: User;

  async function signedInUser(name: string): Promise<User> {
    const suffix = Math.random().toString(36).slice(2, 10);
    const email = `${name}-${suffix}@jesttest.pickld.test`;
    const password = `${Math.random().toString(36)}${Math.random().toString(36)}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    people.push(data.user.id);
    const username = `${name.slice(0, 2)}_${suffix}`;
    await admin.from('profiles').insert({ id: data.user.id, username, display_name: name, birthday: '1995-05-05' });
    const client = createClient<Database>(env.API_URL, env.ANON_KEY, { ...noSession, global: { fetch: nodeFetch } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`sign in: ${signInError.message}`);
    return { id: data.user.id, username, client };
  }

  const as = <T>(user: User, run: () => Promise<T>) => {
    mockClient = user.client;
    return run();
  };
  const profileOf = async (viewer: User, of: User) => {
    const page = await as(viewer, () => fetchProfile(of.username, viewer.id));
    if (!page) throw new Error(`${of.username} not visible to ${viewer.username}`);
    return page;
  };

  beforeAll(async () => {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: resolve(__dirname, '../../../../../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    env = JSON.parse(out.slice(out.indexOf('{'))) as Status;
    admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, { ...noSession, global: { fetch: nodeFetch } });
    author = await signedInUser('author');
    reader = await signedInUser('reader');
    stranger = await signedInUser('stranger');
  }, 60_000);

  afterAll(async () => {
    for (const id of people) await admin.auth.admin.deleteUser(id);
  });

  it('Read updates the counts on both profiles and the relationship both ways', async () => {
    await as(reader, () => setReading(reader.id, author.id, true));
    // Reading twice (another device) is not an error and doesn't count twice.
    await as(reader, () => setReading(reader.id, author.id, true));

    const authorSeenByReader = await profileOf(reader, author);
    expect(authorSeenByReader.profile.reader_count).toBe(1);
    expect(authorSeenByReader.relationship).toEqual({ reading: true, readsYou: false });
    expect((await profileOf(stranger, reader)).profile.author_count).toBe(1);
    expect((await profileOf(author, reader)).relationship).toEqual({ reading: false, readsYou: true });

    const readers = await as(author, () => fetchFollowList(author.id, 'readers', ''));
    expect(readers.map((r) => [r.username, r.is_following, r.follows_viewer])).toEqual([
      [reader.username, false, true],
    ]);
  });

  it('nobody can make someone else read them', async () => {
    await expect(as(stranger, () => setReading(author.id, stranger.id, true))).rejects.toThrow();
    expect((await profileOf(stranger, stranger)).profile.reader_count).toBe(0);
  });

  it('Reading stops it, and the author can remove a reader; both counts drop', async () => {
    await as(reader, () => setReading(reader.id, author.id, false));
    expect((await profileOf(reader, author)).profile.reader_count).toBe(0);
    expect((await profileOf(reader, reader)).profile.author_count).toBe(0);

    await as(reader, () => setReading(reader.id, author.id, true));
    await as(author, () => removeReader(author.id, reader.id));
    expect((await profileOf(author, author)).profile.reader_count).toBe(0);
    expect((await profileOf(author, reader)).profile.author_count).toBe(0);
    expect(await as(author, () => fetchFollowList(author.id, 'readers', ''))).toEqual([]);
  });
});
