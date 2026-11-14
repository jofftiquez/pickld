// fn:upload-url (M1-15; NFR-SEC-02, FR-ACC-05, FR-JAR-03). Returns presigned PUT URLs for a moment's
// photo and thumbnail, or for an avatar or cover. The app uploads straight to the bucket, then writes
// the returned keys into moments / profiles. Each call gets new keys, so nothing is overwritten.
//
// POST { kind: 'moment', jarId, photo: { contentType, size }, medium?: { contentType, size }, thumb: { contentType, size } }
// POST { kind: 'avatar' | 'cover', file: { contentType, size } }
//   → { data: { kind, expiresAt, files: { photo, medium?, thumb } | { file } } }   each: { key, url, method, headers }
// medium (NFR-PERF-02) is the 1080 × 1440 feed copy; it is optional, so older app versions keep uploading without it.
//   → { error: { code, message } }
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { newMomentKeys, newProfileImageKey } from '../_shared/object_keys.ts';
import { presignObject, type S3Config } from '../_shared/sigv4.ts';

/** Upload URLs expire well within the 10 minutes the acceptance criteria allow. */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/** Bytes. Photos are 3:4 WebP (or JPEG) files resized on the device (expo-image-manipulator), location EXIF stripped. */
export const SIZE_LIMITS = {
  photo: 5 * 1024 * 1024,
  medium: 2 * 1024 * 1024,
  thumb: 512 * 1024,
  avatar: 2 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
} as const;

const file = (max: number) =>
  z.strictObject({
    contentType: z.enum(['image/webp', 'image/jpeg']),
    size: z.number().int().min(1).max(max),
  });

export const UploadUrlInput = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('moment'),
    jarId: z.uuid(),
    photo: file(SIZE_LIMITS.photo),
    medium: file(SIZE_LIMITS.medium).optional(),
    thumb: file(SIZE_LIMITS.thumb),
  }),
  z.strictObject({ kind: z.literal('avatar'), file: file(SIZE_LIMITS.avatar) }),
  z.strictObject({ kind: z.literal('cover'), file: file(SIZE_LIMITS.cover) }),
]);
export type UploadUrlInput = z.infer<typeof UploadUrlInput>;

export interface SignedUpload {
  key: string;
  url: string;
  method: 'PUT';
  /** Send exactly these headers; they are part of the signature. */
  headers: Record<string, string>;
}

export interface UploadUrlDeps {
  s3: () => S3Config;
  userClient: (jwt: string) => SupabaseClient;
  now?: () => Date;
}

export async function handleUploadUrl(req: Request, deps: UploadUrlDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in to upload.');
  const client = deps.userClient(jwt);
  const { data: auth } = await client.auth.getUser(jwt);
  const userId = auth.user?.id;
  if (!userId) return fail(401, 'unauthorized', 'Sign in to upload.');

  const body = await readJson(req);
  if (body === null) return fail(400, 'invalid_json', 'The request body must be JSON.');
  const parsed = UploadUrlInput.safeParse(body);
  if (!parsed.success) {
    return fail(
      400,
      'invalid_input',
      'The upload request is not valid.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    );
  }
  const input = parsed.data;

  // D-11: suspended and deleted accounts can't write anything.
  const { data: active, error: activeError } = await client.rpc('is_active_user');
  if (activeError) throw new Error(`is_active_user: ${activeError.message}`);
  if (active !== true) return fail(403, 'account_inactive', 'This account can’t upload right now.');

  if (input.kind === 'moment') {
    // RLS lets others see published jars too, so ownership is checked explicitly.
    const { data: jar, error } = await client.from('jars').select('id').eq('id', input.jarId).eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`jar lookup: ${error.message}`);
    if (!jar) return fail(403, 'jar_not_owned', 'You can only add moments to your own jars.');
  }

  const now = deps.now?.() ?? new Date();
  const s3 = deps.s3();
  const sign = async (key: string, f: { contentType: string; size: number }): Promise<SignedUpload> => {
    const headers = { 'content-type': f.contentType, 'content-length': String(f.size) };
    const url = await presignObject(s3, key, { method: 'PUT', expiresIn: UPLOAD_URL_TTL_SECONDS, headers, now });
    return { key, url, method: 'PUT', headers };
  };
  const expiresAt = new Date(Math.floor(now.getTime() / 1000) * 1000 + UPLOAD_URL_TTL_SECONDS * 1000).toISOString();

  if (input.kind === 'moment') {
    const keys = newMomentKeys(userId);
    const [photo, thumb, medium] = await Promise.all([
      sign(keys.photo, input.photo),
      sign(keys.thumb, input.thumb),
      input.medium ? sign(keys.medium, input.medium) : null,
    ]);
    return ok({ kind: input.kind, expiresAt, files: medium ? { photo, medium, thumb } : { photo, thumb } });
  }
  const upload = await sign(newProfileImageKey(input.kind, userId), input.file);
  return ok({ kind: input.kind, expiresAt, files: { file: upload } });
}
