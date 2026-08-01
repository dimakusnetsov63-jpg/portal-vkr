import { NextResponse } from "next/server";
import { SESSION_MAX_AGE_SECONDS, SESSION_COOKIE, login, sessionCookieOptions } from "@/lib/auth/session";
import type { PortalLoginFailure } from "@/lib/supabase/portalAuth.types";

/**
 * Вход по логину и паролю.
 *
 * Проверку выполняет база (`portal_login`): пароль сюда приходит, но никуда
 * не сохраняется и в ответ не возвращается. Токен сессии уходит в
 * httpOnly-cookie — браузерный JS его не читает.
 */

const FAILURE_MESSAGES: Record<PortalLoginFailure, string> = {
  invalid_credentials: "Неверный логин или пароль",
  disabled: "Учетная запись отключена администратором.",
  // Заменяется точным сроком, когда база вернула `retry_after` — см. ниже.
  throttled: "Слишком много попыток входа. Попробуйте позже",
};

/**
 * Срок до следующей попытки словами. Окно растёт экспоненциально, поэтому
 * фиксированной подписи недостаточно: она была бы неправдой почти всегда.
 *
 * Единицы «с» и «мин» не склоняются — множественного числа тут не возникает.
 */
function throttleMessage(retryAfter: number | undefined): string {
  if (!retryAfter || retryAfter <= 0) return FAILURE_MESSAGES.throttled;
  if (retryAfter < 60) return `Слишком много попыток входа. Попробуйте через ${retryAfter} с`;
  return `Слишком много попыток входа. Попробуйте через ${Math.ceil(retryAfter / 60)} мин`;
}

/**
 * Адрес источника запроса.
 *
 * Только из заголовка и только на сервере. Из тела запроса IP не принимается
 * никогда: тело контролирует клиент, и лимит по источнику обходился бы одной
 * строкой в curl.
 *
 * `x-forwarded-for` — список через запятую, клиент ближе всего к началу.
 * На Vercel заголовок нормализует платформа, и левому значению можно верить.
 * В локальной разработке заголовка обычно нет вовсе — тогда возвращается
 * `null`, и ограничение по источнику не применяется (см. `portal_login`:
 * единый счётчик для всех «неизвестных» означал бы, что один источник
 * закрывает вход всем сразу).
 */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  return forwarded.split(",")[0]?.trim() || null;
}

export async function POST(request: Request) {
  let payload: { login?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const loginName = typeof payload.login === "string" ? payload.login : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!loginName || !password) {
    return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
  }

  let result;
  try {
    result = await login(loginName, password, request.headers.get("user-agent"), clientIp(request));
  } catch {
    return NextResponse.json({ error: "Сервис авторизации недоступен. Попробуйте позже" }, { status: 502 });
  }

  if (!result.ok) {
    if (result.reason === "throttled") {
      // 429 вместо 401: причина отказа не в учётных данных, и промежуточные
      // узлы (в т.ч. браузер) трактуют эти коды по-разному. Retry-After —
      // стандартный заголовок для того же значения, что и в тексте.
      const retryAfter = result.retry_after;
      return NextResponse.json(
        { error: throttleMessage(retryAfter) },
        {
          status: 429,
          headers: retryAfter && retryAfter > 0 ? { "Retry-After": String(retryAfter) } : undefined,
        },
      );
    }
    return NextResponse.json({ error: FAILURE_MESSAGES[result.reason] }, { status: 401 });
  }

  const response = NextResponse.json({ user: result.user });
  response.cookies.set(SESSION_COOKIE, result.token, {
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
