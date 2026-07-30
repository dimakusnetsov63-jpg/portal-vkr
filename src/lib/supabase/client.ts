import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";
import { getPortalAccessToken } from "./accessToken";
import type { Database } from "./database.types";
import type { PortalAuthDatabase } from "./portalAuth.types";

const clientOptions = {
  // Портал не использует Supabase Auth: токен выпускает он сам под свою
  // сессию (`/api/auth/token`). При заданном accessToken supabase-js не
  // поднимает собственный auth-клиент — обращение к `supabase.auth` из
  // такого клиента намеренно бросает исключение.
  accessToken: getPortalAccessToken,
} as const;

/**
 * Supabase client for use in Client Components (browser).
 * Create a new instance per call site — the access token is cached in
 * `accessToken.ts`, so extra instances cost nothing.
 */
export function createClient() {
  return createSupabaseClient<Database>(supabaseEnv.url(), supabaseEnv.publishableKey(), clientOptions);
}

/**
 * Клиент для RPC встроенной авторизации (управление пользователями).
 * Отдельная схема типов, потому что этих функций нет в генерируемом
 * `database.types.ts` — см. `portalAuth.types.ts`.
 */
export function createPortalAuthClient() {
  return createSupabaseClient<PortalAuthDatabase>(supabaseEnv.url(), supabaseEnv.publishableKey(), clientOptions);
}
