import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, type PortalSession, resolveSession } from "./session";
import { canAccess, isPortalPage } from "./roles";
import type { PortalPage } from "@/lib/portal/types";

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
  if (pathname === "/" && section && isPortalPage(section) && !canViewSection(session, section)) {
    return redirectTo(FORBIDDEN_PATH);
  }

  return NextResponse.next();
}

/**
 * Может ли пользователь открыть раздел. Права приходят с сервера — из той
 * же таблицы `portal_section_permissions`, на которую смотрит RLS, поэтому
 * middleware и база отвечают на вопрос доступа одинаково, а не по двум
 * независимым матрицам, как было до фазы D.
 *
 * Проверяется `can_view`, а не `visible`: скрытый пункт меню — это UX, и
 * прямой заход по URL обязан упираться именно в право читать раздел.
 * Обратное сочетание (`visible` без `can_view`) невозможно — запрещено
 * CHECK-ограничением таблицы.
 *
 * Запасной путь на `roles.ts` нужен ровно для одного случая: код выкачен, а
 * миграции фазы D ещё не применены — тогда `permissions` в ответе RPC не
 * будет вовсе. Прав он не расширяет: baseline матрицы воспроизводит
 * `ROLE_PERMISSIONS` один в один, поэтому запасной путь даёт тот же ответ,
 * что и основной. Настоящая граница доступа к данным в любом случае не
 * здесь, а в политиках RLS.
 */
export function canViewSection(session: PortalSession, section: PortalPage): boolean {
  const permission = session.user.permissions?.[section];
  if (!permission) return canAccess(session.user.role, section);
  return permission.can_view;
}
