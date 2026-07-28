import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import type { PortalAuthDatabase, PortalLoginResult, PortalUser } from "@/lib/supabase/portalAuth.types";

/**
 * Сессии портала: создание, проверка, закрытие.
 *
 * Токен сессии живёт только в httpOnly-cookie и в базе (в виде sha256).
 * Браузерный JS его не видит вообще — поэтому вход, выход и проверка сессии
 * идут через серверные маршруты `/api/auth/*`, а не напрямую из компонента.
 *
 * Модуль не импортирует `next/headers`: он должен работать и в middleware
 * (Edge runtime). Чтение cookie в Server Components — в `serverSession.ts`.
 */

export const SESSION_COOKIE = "portal_session";

/** Совпадает со сроком жизни сессии в `portal_login` (скользящие 12 часов). */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface PortalSession {
  sessionId: string;
  user: PortalUser;
}

/** Клиент без сессии: auth-RPC вызываются от роли `anon`, право проверяется внутри функций. */
function authDb() {
  return createClient<PortalAuthDatabase>(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export async function login(loginName: string, password: string, userAgent: string | null): Promise<PortalLoginResult> {
  const { data, error } = await authDb().rpc("portal_login", {
    p_login: loginName,
    p_password: password,
    p_user_agent: userAgent,
  });
  if (error) throw error;
  return data;
}

/**
 * Кто стоит за токеном. `null` — сессии нет, она истекла, отозвана или
 * пользователь отключён администратором: во всех случаях доступ закрыт.
 */
export async function resolveSession(token: string | null | undefined): Promise<PortalSession | null> {
  if (!token) return null;
  const { data, error } = await authDb().rpc("portal_session_context", { p_token: token });
  // Сеть или база недоступны — считаем, что сессии нет. Пускать дальше
  // запрос, который не удалось проверить, нельзя.
  if (error || !data.ok) return null;
  return { sessionId: data.session_id, user: data.user };
}

export async function logout(token: string | null | undefined): Promise<void> {
  if (!token) return;
  const { error } = await authDb().rpc("portal_logout", { p_token: token });
  if (error) throw error;
}
