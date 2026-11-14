// fn:sticker-studio (FR-MOD-10). The console's Sticker Studio sends sticker art here; the function checks the
// PNG, writes it to the bucket under the catalog key and records it, all as the moderator's own session (no
// service key). Postgres decides who may upload and where (mod_studio_art_key, mod_studio_put_art, 0102):
// moderators only, free packs only, and a published pack's existing key is never written again (D-25, D-46).
//
// POST multipart/form-data { pack: uuid, name: key part, label?: text, file: PNG }
//   → { data: { result: 'added' | 'replaced', id, version, key, width, height } }
//   → { error: { code, message } }
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { putObject } from '../_shared/bucket.ts';
import { bearerToken, fail, ok } from '../_shared/http.ts';
import type { S3Config } from '../_shared/sigv4.ts';

/** Sticker art is small: the bundled packs' files are about 25 KB. */
export const MAX_ART_BYTES = 2 * 1024 * 1024;
/** Pixels on each side, as stickers.art_width and art_height allow (0100). */
export const MAX_ART_SIDE = 2048;

const Fields = z.strictObject({
  pack: z.uuid(),
  name: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/).max(60),
  label: z.string().trim().max(40).optional(),
});

const KeyReply = z.union([
  z.object({ result: z.literal('ok'), key: z.string(), replace: z.boolean() }),
  z.object({ result: z.enum(['bad_name', 'not_found', 'not_editable', 'name_taken']) }),
]);
const PutReply = z.union([
  z.object({ result: z.enum(['added', 'replaced']), id: z.uuid(), version: z.number().int() }),
  z.object({ result: z.enum(['bad_name', 'not_found', 'not_editable', 'name_taken']) }),
]);

const REFUSALS = {
  bad_name: [400, 'A sticker name is lower-case letters, digits and hyphens.'],
  not_found: [404, 'That pack doesn’t exist.'],
  not_editable: [403, 'Only free packs are edited in the Studio.'],
  name_taken: [409, 'That name is already used in this published pack. Use a new name.'],
} as const;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a PNG's IHDR chunk, or null when the bytes aren't a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export interface StickerStudioDeps {
  /** The bucket as this function reaches it (s3ServerConfigFromEnv). */
  s3: () => S3Config;
  userClient: (jwt: string) => SupabaseClient;
}

export async function handleStickerStudio(req: Request, deps: StickerStudioDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in to upload.');

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'invalid_input', 'Send the art as multipart/form-data.');
  }
  const file = form.get('file');
  const parsed = Fields.safeParse({
    pack: form.get('pack'),
    name: form.get('name'),
    label: form.get('label') || undefined,
  });
  if (!parsed.success || !(file instanceof File)) {
    return fail(400, 'invalid_input', 'The upload needs a pack, a name and a PNG file.');
  }
  if (file.size === 0 || file.size > MAX_ART_BYTES) return fail(400, 'too_large', 'Art is at most 2 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = pngSize(bytes);
  if (!size) return fail(400, 'not_png', 'Art must be a PNG file.');
  if (size.width < 1 || size.height < 1 || size.width > MAX_ART_SIDE || size.height > MAX_ART_SIDE) {
    return fail(400, 'bad_size', `Art is at most ${MAX_ART_SIDE} pixels on each side.`);
  }
  const { pack, name, label } = parsed.data;

  const client = deps.userClient(jwt);
  const keyCall = await client.rpc('mod_studio_art_key', { p_pack: pack, p_name: name });
  if (keyCall.error) {
    if (keyCall.error.code === '42501') return fail(403, 'not_moderator', 'Only moderators use the Studio.');
    throw new Error(`mod_studio_art_key: ${keyCall.error.message}`);
  }
  const key = KeyReply.parse(keyCall.data);
  if (key.result !== 'ok') return fail(REFUSALS[key.result][0], key.result, REFUSALS[key.result][1]);

  try {
    await putObject(deps.s3(), key.key, bytes, 'image/png');
  } catch (e) {
    console.error(`sticker-studio upload: ${e instanceof Error ? e.message : e}`);
    return fail(502, 'upload_failed', 'The art couldn’t be stored. Try again.');
  }

  const putCall = await client.rpc('mod_studio_put_art', {
    p_pack: pack,
    p_name: name,
    p_label: label ?? null,
    p_width: size.width,
    p_height: size.height,
  });
  if (putCall.error) throw new Error(`mod_studio_put_art: ${putCall.error.message}`);
  const put = PutReply.parse(putCall.data);
  if (put.result !== 'added' && put.result !== 'replaced') {
    return fail(REFUSALS[put.result][0], put.result, REFUSALS[put.result][1]);
  }
  return ok({ result: put.result, id: put.id, version: put.version, key: key.key, ...size });
}
