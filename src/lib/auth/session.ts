import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { signPortalServiceJwt } from "./jwt";
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

/**
 * Внутренний заголовок, которым middleware передаёт уже проверенную сессию
 * дальше по конвейеру — Server Components и Route Handlers читают её оттуда
 * вместо повторного `portal_session_context`.
 *
 * Один заход на `/` стоил двух обращений к базе: сначала `guardRequest` в
 * `proxy.ts`, потом `getPortalSession()` на самой странице. Оба спрашивали
 * одно и то же про один и тот же токен в пределах одного запроса — а
 * функция ещё и volatile, то есть раз в пять минут делает UPDATE.
 *
 * ЗАГОЛОВОК НЕ ЯВЛЯЕТСЯ ПРЕДЪЯВЛЕНИЕМ ПРАВ. Доверять ему можно ровно
 * потому, что `guardRequest` безусловно удаляет пришедший снаружи заголовок
 * с этим именем до всех проверок (см. `stripForgedSessionHeader`), и
 * выставляет его только сам. Без этого шага любой клиент входил бы кем
 * угодно, отправив один заголовок — поэтому удаление сделано первым
 * действием, до любой ветки с ранним возвратом.
 *
 * Настоящая граница доступа к данным в любом случае не здесь, а в политиках
 * RLS: токен для PostgREST подписывается отдельно и содержимое этого
 * заголовка не использует.
 */
export const SESSION_HEADER = "x-portal-session";

/**
 * base64 от UTF-8, а не сырой JSON: значения заголовков — latin1, а
 * `full_name` пользователя кириллический. Подписывать нечего — заголовок
 * никогда не покидает серверный конвейер и не пересекает границу доверия.
 */
export function encodeSessionHeader(session: PortalSession): string {
  const bytes = new TextEncoder().encode(JSON.stringify(session));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** `null` на любом повреждённом значении — вызывающий тогда просто спросит базу. */
export function decodeSessionHeader(value: string | null | undefined): PortalSession | null {
  if (!value) return null;
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as PortalSession;
    return parsed.sessionId && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Клиент для auth-RPC. Ходит под доверенной ролью `portal_auth_caller`, а не
 * под `anon`: только так ограничение частоты по источнику внутри
 * `portal_login` становится достоверным — см. `signPortalServiceJwt`.
 *
 * Токен передаётся через опцию `accessToken`, тем же способом, что и в
 * `lib/supabase/client.ts`: supabase-js тогда не поднимает собственный
 * auth-клиент и просто подставляет заголовок. Функция остаётся синхронной, а
 * подпись выполняется лениво, уже внутри запроса.
 */
function authDb() {
  return createClient<PortalAuthDatabase>(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    accessToken: signPortalServiceJwt,
  });
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/**
 * Вход. `ip` — обязательный аргумент, а не опциональный: без него ограничение
 * частоты по источнику молча не работает, и такую ошибку не поймает ничто.
 * Пусть вызывающий явно передаст `null`, если источник неизвестен.
 *
 * Адрес берётся только из заголовка запроса на сервере (см.
 * `/api/auth/login`) и никогда из тела: значение в теле контролирует клиент,
 * то есть атакующий обошёл бы лимит одной строкой.
 */
export async function login(
  loginName: string,
  password: string,
  userAgent: string | null,
  ip: string | null,
): Promise<PortalLoginResult> {
  const { data, error } = await authDb().rpc("portal_login", {
    p_login: loginName,
    p_password: password,
    p_user_agent: userAgent,
    p_ip: ip,
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
