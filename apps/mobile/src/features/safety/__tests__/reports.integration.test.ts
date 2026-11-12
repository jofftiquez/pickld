/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../lib/database.types';
import { nodeFetch } from '../../../lib/queue/__tests__/nodeFetch';
import { ReportError, submitReport } from '../submitReport';

// Report (M3-21) against the local stack: the app's submitReport through submit_report (0021) lands in the
// moderation queue once, refuses your own profile and what you can't see. Skipped unless
// PICKLD_INTEGRATION=1; needs `pnpm db:start`.
//
//   cd apps/mobile && PICKLD_INTEGRATION=1 npx jest reports.integration

let mockClient: SupabaseClient<Database> | null = null;
jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));

const describeLocal = process.env.PICKLD_INTEGRATION === '1' ? describe : describe.skip;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
type Status = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
type User = { id: string; client: SupabaseClient<Database> };

describeLocal('Reports against local Supabase', () => {
  let env: Status;
  let admin: SupabaseClient<Database>;
  const people: string[] = [];
  let author: User, reporter: User;

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

  const as = <T>(user: User, run: () => Promise<T>) => {
    mockClient = user.client;
    return run();
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
    reporter = await signedInUser('reporter');
  }, 60_000);

  afterAll(async () => {
    for (const id of people) await admin.auth.admin.deleteUser(id);
  });

  it('a profile report reaches the moderation queue once, even after a repeat tap', async () => {
    await as(reporter, () => submitReport({ target: 'profile', targetId: author.id, reason: 'spam' }));
    await as(reporter, () => submitReport({ target: 'profile', targetId: author.id, reason: 'spam' }));

    const reports = await admin.from('reports').select('reason, moderation_item_id').eq('target_id', author.id);
    expect(reports.data).toHaveLength(1);
    const items = await admin
      .from('moderation_items')
      .select('id, source, status, profile_id')
      .eq('profile_id', author.id);
    expect(items.data).toEqual([
      { id: reports.data![0]!.moderation_item_id, source: 'report', status: 'pending', profile_id: author.id },
    ]);
    // The reported person can't read who reported them.
    expect((await author.client.from('reports').select('reporter_id')).data).toEqual([]);
  });

  it('refuses your own profile and things you can’t see', async () => {
    await expect(
      as(author, () => submitReport({ target: 'profile', targetId: author.id, reason: 'spam' })),
    ).rejects.toEqual(new ReportError('own'));
    await expect(
      as(reporter, () =>
        submitReport({ target: 'moment', targetId: '00000000-0000-4000-8000-000000000000', reason: 'other' }),
      ),
    ).rejects.toEqual(new ReportError('unavailable'));
  });
});
