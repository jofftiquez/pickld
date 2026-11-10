// Test support for Edge Function tests against the local Supabase stack (`pnpm db:start`).
// Keys are read at runtime from `supabase status`; nothing is stored in the repo. Test users get a
// random password so they can sign in here only; the app itself has no password sign-in.
import { createClient, type SupabaseClient } from '../_shared/deps.ts';
import type { S3Config } from '../_shared/sigv4.ts';

interface Status {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  STORAGE_S3_URL: string;
  S3_PROTOCOL_REGION: string;
  S3_PROTOCOL_ACCESS_KEY_ID: string;
  S3_PROTOCOL_ACCESS_KEY_SECRET: string;
}

let status: Promise<Status> | undefined;

export function localStatus(): Promise<Status> {
  return status ??= (async () => {
    const out = await new Deno.Command('pnpm', {
      args: ['exec', 'supabase', 'status', '-o', 'json'],
      stdout: 'piped',
      stderr: 'null',
    }).output();
    const text = new TextDecoder().decode(out.stdout);
    if (!text.includes('{')) throw new Error('local Supabase is not running: run `pnpm db:start`');
    const s = JSON.parse(text.slice(text.indexOf('{'))) as Status;
    // The functions read these through env.ts, as they would in the Edge runtime.
    Deno.env.set('SUPABASE_URL', s.API_URL);
    Deno.env.set('SUPABASE_ANON_KEY', s.ANON_KEY);
    return s;
  })();
}

export async function localS3(): Promise<S3Config> {
  const s = await localStatus();
  return {
    endpoint: s.STORAGE_S3_URL,
    region: s.S3_PROTOCOL_REGION || 'local',
    bucket: 'photos',
    accessKeyId: s.S3_PROTOCOL_ACCESS_KEY_ID,
    secretAccessKey: s.S3_PROTOCOL_ACCESS_KEY_SECRET,
  };
}

/** Server-side client for fixtures only (bypasses RLS, like the postgres role in pgTAP). */
export async function admin(): Promise<SupabaseClient> {
  const s = await localStatus();
  return createClient(s.API_URL, s.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  jwt: string;
  name: string;
}

const created: string[] = [];

/** An auth user with an active profile, signed in. `role: 'moderator'` sets app_metadata.role. */
export async function createUser(name: string, opts: { role?: 'moderator' } = {}): Promise<TestUser> {
  const s = await localStatus();
  const db = await admin();
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `${name}-${suffix}@fntest.pickld.test`;
  const password = crypto.randomUUID() + crypto.randomUUID();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: opts.role ? { role: opts.role } : {},
  });
  if (error || !data.user) throw new Error(`createUser ${name}: ${error?.message}`);
  const id = data.user.id;
  created.push(id);
  const { error: pErr } = await db.from('profiles').insert({
    id,
    username: `f_${name.slice(0, 8)}_${suffix}`,
    display_name: name,
    birthday: '1995-05-05',
  });
  if (pErr) throw new Error(`profile ${name}: ${pErr.message}`);
  const anon = createClient(s.API_URL, s.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr || !session.session) throw new Error(`sign in ${name}: ${sErr?.message}`);
  return { id, jwt: session.session.access_token, name };
}

/** Deletes every user created by createUser (profiles, jars and moments cascade). */
export async function cleanup(): Promise<void> {
  const db = await admin();
  for (const id of created.splice(0)) await db.auth.admin.deleteUser(id);
}

/** Inserts a row as the server and returns it. */
export async function insert<T extends Record<string, unknown>>(table: string, row: Record<string, unknown>): Promise<T> {
  const db = await admin();
  const { data, error } = await db.from(table).insert(row).select().single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data as T;
}

/** Today's date (YYYY-MM-DD) in a zone, minus some days. */
export function localDate(tz = 'Asia/Manila', daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

export function request(path: string, opts: { jwt?: string; body?: unknown; method?: string } = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.jwt) headers.authorization = `Bearer ${opts.jwt}`;
  return new Request(`http://fn.local/${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
  });
}
