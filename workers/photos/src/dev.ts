// Local photo server: the same handler as the Worker, backed by the local S3 stand-in.
//   cd workers/photos && deno task dev        → http://127.0.0.1:55430/<key>?exp=…&sig=…
import { handlePhotoRequest } from './handler.ts';
import { localS3Config, requireTokenSecret } from './local.ts';
import { s3Store } from './stores.ts';

const secret = requireTokenSecret();
const store = s3Store(await localS3Config());
const port = Number(Deno.env.get('PHOTOS_PORT') ?? 55430);

Deno.serve({ hostname: '127.0.0.1', port }, (req) => handlePhotoRequest(req, store, secret));
