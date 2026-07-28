import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, resolveSession } from "./session";
import { canAccess, isPortalPage } from "./roles";

/**
 * Централизованная проверка доступа. Выполняется перед каждым защищённым
 * маршрутом (`src/proxy.ts`) и отвечает на три вопроса подряд:
 * есть ли действующая сессия, активен ли пользователь (оба — внутри
 * `resolveSession`, ответ даёт база) и есть ли у его роли доступ к
 * запрошенному разделу.
 */

/** Доступно без сессии. Восстановления пароля пока нет — пароль меняет администратор. */
const PUBLIC_PATHS = ["/login"];

/** Страница «нет доступа». Открывается уже вошедшему пользователю. */
const FORBIDDEN_PATH = "/403";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function guardRequest(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;

  // Маршруты входа/выхода/выпуска токена проверяют себя сами: middleware,
  // редиректящий /api/auth/login на /login, сделал бы вход невозможным.
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  };

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await resolveSession(token);

  if (!session) {
    if (isPublicPath(pathname)) return NextResponse.next();
    const response = redirectTo("/login");
    // Cookie могла остаться от отозванной или истёкшей сессии — иначе
    // отключённый пользователь ходил бы по кругу /login → / → /login.
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (isPublicPath(pathname)) {
    return redirectTo("/");
  }

  // Портал — SPA на `/`, раздел передаётся параметром `?section=`. Это
  // единственное, по чему на уровне маршрута видно, куда именно идёт
  // пользователь.
  const section = searchParams.get("section");
  if (pathname === "/" && section && isPortalPage(section) && !canAccess(session.user.role, section)) {
    return redirectTo(FORBIDDEN_PATH);
  }

  return NextResponse.next();
}
