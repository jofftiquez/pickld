// AWS Signature Version 4 query-string presigning for S3-compatible storage: Cloudflare R2 in staging
// and production, the local Supabase Storage S3 endpoint in development. Plain Web Crypto, no SDK.
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html

export interface S3Config {
  /** e.g. https://<account>.r2.cloudflarestorage.com, or http://127.0.0.1:55421/storage/v1/s3 locally */
  endpoint: string;
  region: string; // 'auto' for R2, 'local' for local Supabase
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface PresignOptions {
  method: 'GET' | 'HEAD' | 'PUT' | 'DELETE';
  /** Seconds the URL stays valid (1 to 604800). */
  expiresIn: number;
  /** Headers the client must send unchanged, e.g. content-type and content-length for an upload. */
  headers?: Record<string, string>;
  now?: Date;
}

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, encoder.encode(data));
}

/** RFC 3986 encoding as SigV4 requires: everything but A-Z a-z 0-9 - _ . ~ */
function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Presigns a request for an absolute URL (path already in its final, unencoded form). */
export async function presignUrl(
  url: string,
  cfg: Pick<S3Config, 'region' | 'accessKeyId' | 'secretAccessKey'>,
  opts: PresignOptions,
): Promise<string> {
  if (opts.expiresIn < 1 || opts.expiresIn > 604800) throw new Error('expiresIn out of range');
  const u = new URL(url);
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // YYYYMMDDTHHMMSSZ
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${cfg.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: u.host };
  for (const [k, v] of Object.entries(opts.headers ?? {})) headers[k.toLowerCase()] = v.trim();
  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(';');

  const query: [string, string][] = [
    ...[...u.searchParams.entries()],
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${cfg.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(opts.expiresIn)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];
  const canonicalQuery = query
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const canonicalUri = decodeURIComponent(u.pathname).split('/').map(rfc3986).join('/');
  const canonicalHeaders = headerNames.map((h) => `${h}:${headers[h]}\n`).join('');
  const canonicalRequest = [opts.method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD']
    .join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  let key: ArrayBuffer = await hmac(encoder.encode(`AWS4${cfg.secretAccessKey}`), date);
  for (const part of [cfg.region, 's3', 'aws4_request']) key = await hmac(key, part);
  const signature = hex(await hmac(key, stringToSign));

  return `${u.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Path-style object URL: <endpoint>/<bucket>/<key>. */
export function objectUrl(cfg: Pick<S3Config, 'endpoint' | 'bucket'>, key: string): string {
  return `${cfg.endpoint.replace(/\/+$/, '')}/${cfg.bucket}/${key}`;
}

export function presignObject(cfg: S3Config, key: string, opts: PresignOptions): Promise<string> {
  return presignUrl(objectUrl(cfg, key), cfg, opts);
}
