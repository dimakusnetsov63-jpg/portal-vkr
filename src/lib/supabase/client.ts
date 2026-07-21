import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

/**
 * Supabase client for use in Client Components (browser).
 * Create a new instance per call site; @supabase/ssr manages the
 * underlying singleton/cookie sync internally.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseEnv.url(), supabaseEnv.publishableKey());
}
