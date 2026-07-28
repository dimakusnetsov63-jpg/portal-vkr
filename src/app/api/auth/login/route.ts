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
  throttled: "Слишком много неудачных попыток входа. Попробуйте через 15 минут",
};

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
    result = await login(loginName, password, request.headers.get("user-agent"));
  } catch {
    return NextResponse.json({ error: "Сервис авторизации недоступен. Попробуйте позже" }, { status: 502 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: FAILURE_MESSAGES[result.reason] }, { status: 401 });
  }

  const response = NextResponse.json({ user: result.user });
  response.cookies.set(SESSION_COOKIE, result.token, {
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
