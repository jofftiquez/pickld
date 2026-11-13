import { type NextRequest, NextResponse } from 'next/server';

import { originOf } from '~/lib/env';
import { supabase } from '~/lib/supabase';

export async function POST(request: NextRequest) {
  await (await supabase()).auth.signOut();
  return NextResponse.redirect(new URL('/sign-in', originOf(request.headers)), 303);
}
