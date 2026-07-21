import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Supabase client for use in Client Components (browser).
 * Create a new instance per call site; @supabase/ssr manages the
 * underlying singleton/cookie sync internally.
 */
export function createClient() {
  return createBrowserClient(supabaseEnv.url(), supabaseEnv.publishableKey());
}
