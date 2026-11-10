// Every Edge Function answers `{ data } | { error }` (AGENTS.md conventions).

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status, headers: HEADERS });
}

export function fail(status: number, code: string, message: string, details?: unknown): Response {
  const error: ApiError = details === undefined ? { code, message } : { code, message, details };
  return new Response(JSON.stringify({ error }), { status, headers: HEADERS });
}

/** The bearer token from the Authorization header, or null. */
export function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

/** Parses the JSON body; null when it isn't JSON. */
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
