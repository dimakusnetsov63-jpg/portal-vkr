import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Supabase client for use in Server Components, Route Handlers and
 * Server Actions. Must be created fresh per request (reads the request's
 * cookie store via `next/headers`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore as long as a
          // middleware refreshes the user session (see project notes on
          // adding auth middleware once cookie-based auth is introduced).
        }
      },
    },
  });
}
