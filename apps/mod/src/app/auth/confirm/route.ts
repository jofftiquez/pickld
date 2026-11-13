import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { originOf } from '~/lib/env';
import { supabase } from '~/lib/supabase';

// Where the emailed sign-in link lands. The default email template sends ?code= (PKCE; the verifier cookie
// was set when the link was requested); a token_hash template sends ?token_hash=&type=.
const Query = z.union([
  z.object({ code: z.string().min(1) }),
  z.object({ token_hash: z.string().min(1), type: z.enum(['magiclink', 'email']) }),
]);

export async function GET(request: NextRequest) {
  const query = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const client = await supabase();
  let ok = false;
  if (query.success) {
    const { error } =
      'code' in query.data
        ? await client.auth.exchangeCodeForSession(query.data.code)
        : await client.auth.verifyOtp({ token_hash: query.data.token_hash, type: query.data.type as EmailOtpType });
    ok = !error;
  }
  return NextResponse.redirect(new URL(ok ? '/' : '/sign-in?notice=link', originOf(request.headers)));
}
