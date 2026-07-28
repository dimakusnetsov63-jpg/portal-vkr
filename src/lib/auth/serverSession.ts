import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession, type PortalSession } from "./session";

/**
 * Текущая сессия в Server Components и Route Handlers.
 *
 * Отдельно от `session.ts`, потому что `next/headers` недоступен в middleware
 * (Edge runtime), а проверять сессию нужно и там.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  return resolveSession(cookieStore.get(SESSION_COOKIE)?.value);
}
