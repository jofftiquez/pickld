import { NextResponse } from 'next/server';

import { isModerator, supabase } from '~/lib/supabase';
import { exportWaitlist, toCsv } from '~/lib/waitlist';

export const dynamic = 'force-dynamic';

// The whole waitlist as CSV (FR-MOD-08). mod_waitlist_export() refuses non-moderators and writes the audit
// row; this check only turns a signed-out visit into the sign-in page instead of an error.
export async function GET(request: Request) {
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/sign-in', request.url));
  if (!isModerator(user)) return new NextResponse(null, { status: 403 });
  const rows = await exportWaitlist(client);
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="pickld-waitlist-${day}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
