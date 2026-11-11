# Photo Worker

Serves every photo (D-12, NFR-SEC-02). A Cloudflare Worker in front of a private R2 bucket returns an
object only when the URL carries a valid, unexpired HMAC token issued by `fn:photo-urls` after a
visibility check. Anything else gets `403`. There are no permanent public photo URLs, so a jar switched
to Only me stops loading for others when their tokens expire (15 minutes at most).

```
<photo base>/<object key>?exp=<unix seconds>&sig=<base64url HMAC-SHA256("pickld-photo-v1\n<key>\n<exp>")>
```

- **Tokens:** `supabase/functions/_shared/photo_token.ts` (shared with the Edge Functions). The signature
  covers the key and the expiry, so a token can't be moved to another photo or extended. The Worker
  refuses tokens that would live longer than 1 hour.
- **Keys:** `supabase/functions/_shared/object_keys.ts`. Each upload gets a fresh random id
  (`moments/<user>/<upload>/full.jpg` and `thumb.jpg`, `avatars/<user>/<upload>.jpg`,
  `covers/<user>/<upload>.jpg`), so objects are never overwritten. Malformed keys get `403`.
- **Sticker art:** `stickers/<pack slug>/<name>.png` (`stickers.asset_path`, migration 0012) is public
  catalog data that anyone viewing a moment sees, the anonymous web page included (FR-STK-04, C-6), so
  it is served **without a token** with `cache-control: public, max-age=31536000, immutable`. Art never
  changes under a key: new art gets a new file name and a new catalog row.
- **Read-only:** `GET` and `HEAD` only. Uploads go straight to the bucket with presigned PUT URLs from
  `fn:upload-url` (`_shared/sigv4.ts`).

## Local development

The local S3 stand-in is the Supabase Storage S3 endpoint of the local stack; `supabase/seed.sql`
creates the private `photos` bucket. Credentials are read at runtime from `supabase status`.

```sh
cp .env.example .env               # set PHOTO_TOKEN_SECRET (openssl rand -base64 48)
pnpm db:reset                      # from the repo root: creates the bucket
deno task seed                     # uploads design/images under the seed keys and the sticker art, prints two signed URLs
deno task stickers                 # sticker art only (assets/stickers → stickers/…); existing keys are skipped
deno task dev                      # http://127.0.0.1:55430
deno task test                     # valid, expired and tampered tokens; keys; SigV4 test vector
```

### Sticker art

`assets/stickers/<pack>/<name>.png` is rendered from the catalog in the database (rows in migration 0012)
by `node scripts/render-stickers.mjs` from the repo root, after `pnpm db:reset`. To add a sticker: add its
row in a new migration, reset, render, upload. For staging or production, run `deno task stickers` with
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` set to an R2 token with write
access to that bucket.

## Staging and production (needs M1-01 and M1-28)

1. Create R2 buckets `pickld-photos-staging` and `pickld-photos-production` (not public).
2. `wrangler secret put PHOTO_TOKEN_SECRET --env staging` (and `--env production`), and set the same value
   in Supabase: `supabase secrets set PHOTO_TOKEN_SECRET=…`.
3. Create an R2 API token for `fn:upload-url` (object write on that bucket only) and set `S3_ENDPOINT`,
   `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` as Supabase secrets.
4. `wrangler deploy --env staging`; the routes in `wrangler.toml` expect `photos-staging.pickld.me` and
   `photos.pickld.me` on the Cloudflare zone.
