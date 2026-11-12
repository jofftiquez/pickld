// fn:send-push (M3-17; FR-NOT-02, FR-NOT-04; T-206). Called every minute by a Supabase Cron job with the
// x-push-secret header (PUSH_CRON_SECRET); nothing else may call it. Each run:
//   1. push_take() (0020) settles muted, in-app-only, over-the-daily-limit, tokenless and stale rows and
//      claims the rest that are due and outside the person's quiet hours;
//   2. likes on one jar become one push, the rest one each (messages.ts), one Expo message per device;
//   3. messages go to Expo in chunks of 100; tickets are saved, and rows of a chunk Expo couldn't take go
//      back with push_retry() for the next run;
//   4. receipts for tickets older than 15 minutes are read and tokens Expo calls DeviceNotRegistered are
//      deleted (push_receipts_settle).
//
// POST {}  (x-push-secret: …)
//   → { data: { claimed, pushes, messages, failed, receipts, deadTokens } }
//   → { error: { code, message } }   401 wrong secret
import { type SupabaseClient } from '../_shared/deps.ts';
import { fail, ok } from '../_shared/http.ts';
import { composePushes, type DueNotification, type PushMessage, toMessages } from './messages.ts';

export const PUSH_SETTLE_SECONDS = 60;
export const EXPO_CHUNK = 100;
export const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

export type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } };
export type ExpoReceipt = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

/** The database side, as the service role (0020). */
export interface PushStore {
  take(settleSeconds: number): Promise<DueNotification[]>;
  retry(ids: string[]): Promise<void>;
  saveTickets(rows: { ticketId: string; token: string }[]): Promise<void>;
  dueTickets(): Promise<{ ticketId: string; token: string }[]>;
  settleReceipts(ticketIds: string[], deadTokens: string[]): Promise<void>;
}

/** Expo's push API. Throws when Expo can't be reached or answers with an error status. */
export interface ExpoClient {
  send(messages: PushMessage[]): Promise<ExpoTicket[]>;
  receipts(ids: string[]): Promise<Record<string, ExpoReceipt>>;
}

export interface SendPushDeps {
  store: () => PushStore;
  expo: () => ExpoClient;
  secret: () => string;
}

/** Same-length strings compared without an early exit. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function handleSendPush(req: Request, deps: SendPushDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const secret = deps.secret();
  const given = req.headers.get('x-push-secret') ?? '';
  if (secret.length < 32 || !sameSecret(given, secret)) return fail(401, 'unauthorized', 'Not allowed.');

  const store = deps.store();
  const expo = deps.expo();

  // 1–3: send what is due.
  const rows = await store.take(PUSH_SETTLE_SECONDS);
  const sendable = toMessages(composePushes(rows));
  const failedIds = new Set<string>();
  const tickets: { ticketId: string; token: string }[] = [];
  const deadTokens = new Set<string>();
  for (const chunk of chunks(sendable, EXPO_CHUNK)) {
    let answer: ExpoTicket[];
    try {
      answer = await expo.send(chunk.map((c) => c.message));
    } catch {
      for (const c of chunk) for (const id of c.push.data.notificationIds) failedIds.add(id);
      continue;
    }
    answer.forEach((ticket, i) => {
      const token = chunk[i]?.message.to;
      if (!token) return;
      if (ticket.status === 'ok') tickets.push({ ticketId: ticket.id, token });
      else if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.add(token);
    });
  }
  if (tickets.length > 0) await store.saveTickets(tickets);
  if (failedIds.size > 0) await store.retry([...failedIds]);

  // 4: receipts from earlier runs.
  const due = await store.dueTickets();
  let receiptsRead = 0;
  const settled: string[] = [];
  for (const chunk of chunks(due, 1000)) {
    let receipts: Record<string, ExpoReceipt>;
    try {
      receipts = await expo.receipts(chunk.map((t) => t.ticketId));
    } catch {
      continue; // try again next run
    }
    for (const t of chunk) {
      const r = receipts[t.ticketId];
      if (!r) continue; // not ready yet
      receiptsRead += 1;
      settled.push(t.ticketId);
      if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') deadTokens.add(t.token);
    }
  }
  if (settled.length > 0 || deadTokens.size > 0) await store.settleReceipts(settled, [...deadTokens]);

  return ok({
    claimed: rows.length,
    pushes: new Set(sendable.map((s) => s.push)).size,
    messages: sendable.length,
    failed: failedIds.size,
    receipts: receiptsRead,
    deadTokens: deadTokens.size,
  });
}

/** The PushStore over the service-role client and the 0020 functions. */
export function serviceStore(db: SupabaseClient): PushStore {
  return {
    async take(settleSeconds) {
      const { data, error } = await db.rpc('push_take', { p_settle: `${settleSeconds} seconds`, p_limit: 500 });
      if (error) throw new Error(`push_take: ${error.message}`);
      return (data ?? []) as DueNotification[];
    },
    async retry(ids) {
      const { error } = await db.rpc('push_retry', { p_ids: ids });
      if (error) throw new Error(`push_retry: ${error.message}`);
    },
    async saveTickets(rows) {
      const { error } = await db.rpc('push_tickets_save', {
        p_ticket_ids: rows.map((r) => r.ticketId),
        p_tokens: rows.map((r) => r.token),
      });
      if (error) throw new Error(`push_tickets_save: ${error.message}`);
    },
    async dueTickets() {
      const { data, error } = await db.rpc('push_tickets_due', { p_limit: 1000 });
      if (error) throw new Error(`push_tickets_due: ${error.message}`);
      return ((data ?? []) as { ticket_id: string; token: string }[]).map((r) => ({ ticketId: r.ticket_id, token: r.token }));
    },
    async settleReceipts(ticketIds, deadTokens) {
      const { error } = await db.rpc('push_receipts_settle', { p_ticket_ids: ticketIds, p_dead_tokens: deadTokens });
      if (error) throw new Error(`push_receipts_settle: ${error.message}`);
    },
  };
}

/** Expo over fetch. EXPO_ACCESS_TOKEN is optional (needed only if the Expo project enforces push security). */
export function expoClient(accessToken: string | undefined, fetcher: typeof fetch = fetch): ExpoClient {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
  return {
    async send(messages) {
      const res = await fetcher(EXPO_SEND_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
      if (!res.ok) throw new Error(`expo send answered ${res.status}`);
      const body = (await res.json()) as { data?: ExpoTicket[] };
      if (!Array.isArray(body.data) || body.data.length !== messages.length) throw new Error('expo send: bad answer');
      return body.data;
    },
    async receipts(ids) {
      const res = await fetcher(EXPO_RECEIPTS_URL, { method: 'POST', headers, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error(`expo receipts answered ${res.status}`);
      const body = (await res.json()) as { data?: Record<string, ExpoReceipt> };
      return body.data ?? {};
    },
  };
}
