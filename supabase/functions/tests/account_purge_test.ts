// fn:account-purge against the local stack: an Under 13 sign-up (an auth user with no profile) is deleted
// with every object under their prefixes and every auth row naming them; established accounts and other
// people are untouched. Auth tables aren't exposed through the API, so they are read with psql in the database container.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { createClient } from '../_shared/deps.ts';
import { userClient } from '../_shared/env.ts';
import { presignObject, presignUrl } from '../_shared/sigv4.ts';
import { handleAccountPurge, type PurgeStore, serviceStore, userPrefixes } from '../account-purge/handler.ts';
import { admin, cleanup, createUser, localS3, localStatus, request, type TestUser } from './local.ts';

const store = async (): Promise<PurgeStore> => serviceStore(await admin(), await localS3());
const call = async (jwt?: string, s?: PurgeStore, method = 'POST') => {
  const st = s ?? await store();
  const res = await handleAccountPurge(
    request('account-purge', { jwt, method, body: method === 'POST' ? {} : undefined }),
    {
      userClient,
      store: () => st,
    },
  );
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
};

// ---------------------------------------------------------------- fixtures
const signups: string[] = [];

/** An auth user who signed in but has no profile yet: the state the Under 13 screen is in. */
async function createSignup(name: string): Promise<TestUser & { email: string }> {
  const s = await localStatus();
  const db = await admin();
  const email = `${name}-${crypto.randomUUID().slice(0, 8)}@fntest.pickld.test`;
  const password = crypto.randomUUID() + crypto.randomUUID();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser ${name}: ${error?.message}`);
  signups.push(data.user.id);
  const anon = createClient(s.API_URL, s.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr || !session.session) throw new Error(`sign in ${name}: ${sErr?.message}`);
  return { id: data.user.id, jwt: session.session.access_token, name, email };
}

const uploaded: string[] = [];
/** Puts an avatar, a cover and a moment photo + thumbnail in the bucket as the server (keys as in object_keys.ts). */
async function uploadAll(userId: string): Promise<string[]> {
  uploaded.push(userId);
  const s3 = await localS3();
  const m = `moments/${userId}/${crypto.randomUUID()}`;
  const keys = [
    `avatars/${userId}/${crypto.randomUUID()}.jpg`,
    `covers/${userId}/${crypto.randomUUID()}.jpg`,
    `${m}/full.jpg`,
    `${m}/thumb.jpg`,
  ];
  for (const key of keys) {
    const headers = { 'content-type': 'image/jpeg', 'content-length': '3' };
    const res = await fetch(await presignObject(s3, key, { method: 'PUT', expiresIn: 60, headers }), {
      method: 'PUT',
      headers,
      body: 'abc',
    });
    await res.body?.cancel();
    if (!res.ok) throw new Error(`put ${key}: ${res.status}`);
  }
  return keys;
}

/** Keys in the bucket under any of the user's prefixes. */
async function listed(userId: string): Promise<string[]> {
  const s3 = await localS3();
  const out: string[] = [];
  for (const prefix of userPrefixes(userId)) {
    const url = `${s3.endpoint.replace(/\/+$/, '')}/${s3.bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}`;
    const res = await fetch(await presignUrl(url, s3, { method: 'GET', expiresIn: 60 }));
    const xml = await res.text();
    out.push(...[...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((x) => x[1]));
  }
  return out.sort();
}

async function sql<T>(query: string): Promise<T[]> {
  // psql in the stack's database container (named from config.toml's project_id, here and in CI); the
  // CLI's `db query` JSON differs between versions.
  const out = await new Deno.Command('docker', {
    args: ['exec', 'supabase_db_pickld', 'psql', '-U', 'postgres', '-At', '-c',
      `select coalesce(json_agg(t), '[]') from (${query}) t`],
    stdout: 'piped',
    stderr: 'piped',
  }).output();
  if (!out.success) throw new Error(`psql failed: ${new TextDecoder().decode(out.stderr)}`);
  return JSON.parse(new TextDecoder().decode(out.stdout)) as T[];
}

/** Rows anywhere that name the user: auth, storage, and every public table keyed to a user. */
async function traces(id: string, email: string): Promise<Record<string, number>> {
  const rows = await sql<Record<string, number>>(`select
    (select count(*) from auth.users where id = '${id}' or email = '${email}') as users,
    (select count(*) from auth.identities where user_id = '${id}') as identities,
    (select count(*) from auth.sessions where user_id = '${id}') as sessions,
    (select count(*) from auth.refresh_tokens where user_id = '${id}') as refresh_tokens,
    (select count(*) from auth.one_time_tokens where user_id = '${id}') as one_time_tokens,
    (select count(*) from auth.flow_state where user_id = '${id}') as flow_state,
    (select count(*) from auth.audit_log_entries where payload::text like '%${id}%' or payload::text like '%${email}%') as audit,
    (select count(*) from storage.objects where name like '%${id}%') as objects,
    (select count(*) from public.profiles where id = '${id}') as profiles,
    (select count(*) from public.contact_hashes where user_id = '${id}') as contact_hashes,
    (select count(*) from public.push_tokens where user_id = '${id}') as push_tokens,
    (select count(*) from public.onboarding_answers where user_id = '${id}') as onboarding_answers,
    (select count(*) from public.reports where reporter_id = '${id}' or target_id = '${id}') as reports`);
  return Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
}

const sum = (t: Record<string, number>) => Object.values(t).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- tests
Deno.test('an Under 13 sign-up is deleted with everything they uploaded; nothing about them remains', async () => {
  const kid = await createSignup('kid');
  const other = await createSignup('other');
  const keys = await uploadAll(kid.id);
  const otherKeys = await uploadAll(other.id);
  assertEquals(await listed(kid.id), [...keys].sort());
  const before = await traces(kid.id, kid.email);
  assert(before.users === 1 && before.sessions > 0 && before.audit > 0 && before.objects === 4, JSON.stringify(before));

  const { status, json } = await call(kid.jwt);
  assertEquals(status, 200);
  assertEquals(json, { data: { purged: true } });

  assertEquals(await listed(kid.id), []);
  const after = await traces(kid.id, kid.email);
  assertEquals(sum(after), 0, JSON.stringify(after));
  const { data } = await (await admin()).auth.admin.getUserById(kid.id);
  assertEquals(data.user, null);

  // Someone else is untouched.
  assertEquals(await listed(other.id), [...otherKeys].sort());
  const o = await traces(other.id, other.email);
  assertEquals(o.users, 1);
  assertEquals(o.objects, 4);

  // The old token no longer resolves: a repeat call is 401, not a second delete.
  assertEquals((await call(kid.jwt)).status, 401);
});

Deno.test('a retry after a partial failure succeeds', async () => {
  const kid = await createSignup('retry');
  await uploadAll(kid.id);
  const real = await store();
  let fail = true;
  const flaky: PurgeStore = {
    ...real,
    purgeAccount: (id) => {
      if (fail) return Promise.reject(new Error('account_purge: network'));
      return real.purgeAccount(id);
    },
  };
  let threw = false;
  try {
    await call(kid.jwt, flaky);
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals(await listed(kid.id), [], 'photos went first');
  assertEquals((await traces(kid.id, kid.email)).users, 1, 'the account is still there to retry with');

  fail = false;
  assertEquals((await call(kid.jwt, flaky)).status, 200);
  assertEquals(sum(await traces(kid.id, kid.email)), 0);
});

Deno.test('an established account (has a profile) is refused and untouched', async () => {
  const grown = await createUser('grown');
  const keys = await uploadAll(grown.id);
  const { status, json } = await call(grown.jwt);
  assertEquals(status, 403);
  assertEquals(json.error.code, 'not_eligible');
  assertEquals(await listed(grown.id), [...keys].sort());
  const t = await traces(grown.id, 'nobody@example.invalid');
  assertEquals([t.users, t.profiles, t.objects], [1, 1, 4]);

  // The database refuses too, even if asked directly (the race where a profile appears mid-call).
  const { data, error } = await (await admin()).rpc('account_purge', { p_user: grown.id });
  assertEquals(error, null);
  assertEquals(data, false);
  assertEquals((await traces(grown.id, 'nobody@example.invalid')).users, 1);
});

Deno.test('signed-out callers get 401; only POST is accepted', async () => {
  assertEquals((await call(undefined)).status, 401);
  assertEquals((await call('not-a-jwt')).status, 401);
  const kid = await createSignup('getter');
  assertEquals((await call(kid.jwt, undefined, 'GET')).status, 405);
  assertEquals((await traces(kid.id, kid.email)).users, 1);
});

Deno.test('cleanup', async () => {
  const s = await store();
  for (const id of [...uploaded, ...signups]) for (const p of userPrefixes(id)) await s.deletePrefix(p);
  await cleanup();
  const db = await admin();
  for (const id of signups.splice(0)) await db.auth.admin.deleteUser(id).catch(() => undefined);
});
