import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from './lib/env';

// Refreshes the moderator's session on every request (Server Components can't write cookies) and sends
// signed-out visitors to /sign-in. The moderator check itself is in app/(console)/layout.tsx.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  const open = request.nextUrl.pathname.startsWith('/sign-in') || request.nextUrl.pathname.startsWith('/auth/');
  if (!user && !open) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/|favicon.ico).*)'] };
