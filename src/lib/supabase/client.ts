import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";
import { getPortalAccessToken } from "./accessToken";
import type { Database } from "./database.types";
import type { PortalAuthDatabase } from "./portalAuth.types";
import type { AddressesDatabase } from "./addresses.types";

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

/**
 * Клиент для public.addresses. Отдельная схема типов по той же причине, что
 * и у createPortalAuthClient(): таблица ещё не отражена в сгенерированном
 * database.types.ts (миграция не применена к боевой БД), см.
 * addresses.types.ts. После регенерации типов addressesRepo.ts может
 * перейти на общий createClient(), и AddressesDatabase можно будет удалить.
 */
export function createAddressesClient() {
  return createSupabaseClient<AddressesDatabase>(supabaseEnv.url(), supabaseEnv.publishableKey(), clientOptions);
}
