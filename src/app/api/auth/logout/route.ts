import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, logout, sessionCookieOptions } from "@/lib/auth/session";

/**
 * Выход: сессия отзывается в базе, cookie удаляется. Токен доступа к данным
 * живёт не дольше 15 минут и не продлевается — новый без сессии не выпустить.
 */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  try {
    await logout(token);
  } catch {
    // Даже если отозвать сессию не удалось, cookie нужно убрать: иначе
    // пользователь остаётся «вошедшим» в браузере.
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
