import { APP_ID, appIdentity } from '~/lib/env';

// Android app links (FR-WEB-03, M4-15): lets the app's autoVerify intent filter claim pickld.me. 404 until
// ANDROID_CERT_SHA256 (the Play app signing certificate's SHA-256, comma-separated for several) is set.
export const dynamic = 'force-dynamic';

export function GET() {
  const { androidCerts } = appIdentity();
  if (androidCerts.length === 0) return new Response(null, { status: 404 });
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: androidCerts },
    },
  ]);
}
