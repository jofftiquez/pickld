import { request } from 'node:http';

// jest-expo swaps the global fetch for a stub even in the node environment, so the integration tests talk HTTP
// through node:http (local Supabase is plain http).
export const nodeFetch = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> =>
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
