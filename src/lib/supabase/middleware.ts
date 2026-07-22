import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/login"];

/**
 * Refreshes the Supabase session cookies on every request and gates access:
 * unauthenticated requests are redirected to /login, authenticated requests
 * to /login are redirected to /. Must run on every route via src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  // Build a redirect that preserves any auth cookies refreshed by getUser().
  // Returning a bare NextResponse.redirect would drop the rotated session
  // cookies set on supabaseResponse and could log the user out mid-rotation.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  };

  if (!user && !isPublicPath) {
    return redirectTo("/login");
  }

  if (user && isPublicPath) {
    return redirectTo("/");
  }

  return supabaseResponse;
}
