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

/**
 * Защита от login CSRF (находка H-15): `sameSite: "lax"` не спасает от
 * запроса, который вообще не полагается на существующую cookie — атакующий
 * может отправить `POST /api/auth/login` со своими учётными данными и
 * незаметно залогинить жертву в чужой аккаунт.
 *
 * Сравнение `Origin` с `Host`, а не список разрешённых доменов: домен
 * production, preview-окружений Vercel и localhost так покрываются
 * одинаково, без переменной окружения, которую пришлось бы держать
 * синхронизированной с реальными доменами проекта. `Host` на Vercel отдаёт
 * платформа (тот же источник доверия, что уже используется для
 * `x-forwarded-for` в лимите частоты входа, C-3/C-4) — значению можно
 * верить.
 *
 * `Origin` отсутствует только у GET/HEAD и у некоторых опаковых запросов
 * (например, `Origin: null` из sandboxed iframe) — для них `new URL(origin)`
 * бросит исключение, и запрос будет отвергнут, что и требуется: легитимный
 * браузерный `fetch()` с не-GET методом всегда отправляет настоящий `Origin`.
 */
export function isTrustedOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function guardRequest(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;

  // Маршруты входа/выхода/выпуска токена проверяют себя сами: middleware,
  // редиректящий /api/auth/login на /login, сделал бы вход невозможным.
  // Единственное, что здесь всё же проверяется централизованно — Origin на
  // не-GET запросах (см. isTrustedOrigin), чтобы будущий новый маршрут под
  // /api/auth/* не унаследовал login CSRF молча, без отдельного напоминания.
  if (pathname.startsWith("/api/auth/")) {
    if (request.method !== "GET" && !isTrustedOrigin(request.headers.get("origin"), request.headers.get("host"))) {
      return NextResponse.json({ error: "Запрос отклонён: недоверенный источник" }, { status: 403 });
    }
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
