import { cookies, headers } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_HEADER,
  decodeSessionHeader,
  resolveSession,
  type PortalSession,
} from "./session";

/**
 * Текущая сессия в Server Components и Route Handlers.
 *
 * Отдельно от `session.ts`, потому что `next/headers` недоступен в middleware
 * (Edge runtime), а проверять сессию нужно и там.
 *
 * Сначала — то, что уже проверил `guardRequest` в этом же запросе
 * (`SESSION_HEADER`, см. комментарий к нему в `session.ts`): вход на `/`
 * стоил двух `portal_session_context` подряд про один и тот же токен.
 * Обращение к базе остаётся запасным путём — для маршрутов, до которых
 * middleware не доходит (его matcher исключает статику), и для случая, когда
 * заголовок почему-либо не дошёл. Прав он не расширяет: без действующей
 * сессии заголовка не будет вовсе.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const headerStore = await headers();
  const fromMiddleware = decodeSessionHeader(headerStore.get(SESSION_HEADER));
  if (fromMiddleware) return fromMiddleware;

  const cookieStore = await cookies();
  return resolveSession(cookieStore.get(SESSION_COOKIE)?.value);
}
