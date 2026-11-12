import { APP_ID, appIdentity } from '~/lib/env';

// Universal links (FR-WEB-03, M4-15). Profile, jar and sign-in links open the app; legal pages stay on
// the web. Served as JSON with no redirect, as iOS requires. 404 until APPLE_TEAM_ID is set.
export const dynamic = 'force-dynamic';

export function GET() {
  const { appleTeamId } = appIdentity();
  if (!appleTeamId) return new Response(null, { status: 404 });
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [`${appleTeamId}.${APP_ID}`],
          components: [
            { '/': '/terms', exclude: true },
            { '/': '/privacy', exclude: true },
            { '/': '/guidelines', exclude: true },
            { '/': '/.well-known/*', exclude: true },
            { '/': '/j/*' },
            { '/': '/u/*' },
            { '/': '/auth/callback' },
            { '/': '/*' },
          ],
        },
      ],
    },
  });
}
