import { describe, expect, it } from "vitest";
import { canViewSection, isTrustedOrigin } from "./middleware";
import { PORTAL_ROLES, type PortalRole, allowedSections, canAccess } from "./roles";
import type { PortalSession } from "./session";
import type { SectionPermissions } from "@/lib/supabase/portalAuth.types";
import type { PortalPage } from "@/lib/portal/types";

/**
 * Чистая функция сравнения `Origin`/`Host` (H-15) — тестируется без
 * реального `NextRequest`, как и остальная auth-логика проекта.
 */
describe("isTrustedOrigin", () => {
  it("доверяет origin, чей host совпадает с host запроса", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru", "portal-vkr.ru")).toBe(true);
  });

  it("доверяет localhost при совпадении host", () => {
    expect(isTrustedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("отвергает несовпадающий host — межсайтовый запрос", () => {
    expect(isTrustedOrigin("https://evil.example", "portal-vkr.ru")).toBe(false);
  });

  it("отвергает поддомен, даже похожий на легитимный", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru.evil.example", "portal-vkr.ru")).toBe(false);
  });

  it("отвергает отсутствующий Origin", () => {
    expect(isTrustedOrigin(null, "portal-vkr.ru")).toBe(false);
  });

  it("отвергает отсутствующий Host", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru", null)).toBe(false);
  });

  it("отвергает невалидный Origin (например, 'null' из sandboxed iframe)", () => {
    expect(isTrustedOrigin("null", "portal-vkr.ru")).toBe(false);
  });

  it("порт учитывается как часть host — разные порты не совпадают", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru:8443", "portal-vkr.ru")).toBe(false);
  });
});

/**
 * Решение о доступе к разделу с фазы D принимается по матрице, пришедшей с
 * сервера, а не по захардкоженному `ROLE_PERMISSIONS`. Тесты проверяют обе
 * ветки: основную (права есть в payload) и запасную (их нет — код выкачен
 * раньше миграций).
 */
function makeSession(role: PortalRole, permissions?: SectionPermissions): PortalSession {
  return {
    sessionId: "session-id",
    user: {
      id: "user-id",
      full_name: "Тест Тестов",
      login: "test",
      role,
      projects: ["Самокат"],
      all_projects: false,
      is_active: true,
      created_at: "2026-08-13T00:00:00Z",
      updated_at: "2026-08-13T00:00:00Z",
      last_login_at: null,
      permissions: permissions ?? {},
    },
  };
}

function permission(visible: boolean, canView: boolean, canEdit = false) {
  return { visible, can_view: canView, can_edit: canEdit };
}

describe("canViewSection", () => {
  it("пускает, когда can_view = true", () => {
    const session = makeSession("recruiter", { candidates: permission(true, true) });
    expect(canViewSection(session, "candidates")).toBe(true);
  });

  it("не пускает, когда can_view = false", () => {
    const session = makeSession("recruiter", { demand: permission(false, false) });
    expect(canViewSection(session, "demand")).toBe(false);
  });

  it("решает по can_view, а не по visible: скрытый в меню раздел всё равно открывается по прямой ссылке", () => {
    // visible = false — это UX: пункт не показывается в навигации. Но право
    // читать раздел осталось, значит 403 отдавать не за что.
    const session = makeSession("manager", { analytics: permission(false, true) });
    expect(canViewSection(session, "analytics")).toBe(true);
  });

  it("права из payload сильнее роли: у recruiter появился раздел, которого нет в roles.ts", () => {
    // Ровно то, ради чего затевалась фаза D — администратор выдал право
    // через настройки, и middleware обязан это увидеть без передеплоя.
    expect(canAccess("recruiter", "analytics")).toBe(false);
    const session = makeSession("recruiter", { analytics: permission(true, true) });
    expect(canViewSection(session, "analytics")).toBe(true);
  });

  it("права из payload сильнее роли и в обратную сторону: право отобрали", () => {
    expect(canAccess("manager", "demand")).toBe(true);
    const session = makeSession("manager", { demand: permission(false, false) });
    expect(canViewSection(session, "demand")).toBe(false);
  });

  it.each(PORTAL_ROLES)("запасной путь для роли %s повторяет roles.ts, если матрицы нет вовсе", (role) => {
    const session = makeSession(role);
    const allowed = allowedSections(role);
    const denied = (["overview", "demand", "addresses", "candidates", "vacancies", "rates",
      "marketing", "analytics", "notifications", "settings"] as PortalPage[])
      .filter((section) => !allowed.includes(section));

    for (const section of allowed) expect(canViewSection(session, section)).toBe(true);
    for (const section of denied) expect(canViewSection(session, section)).toBe(false);
  });

  it("запасной путь срабатывает и для отдельного раздела, которого нет в матрице", () => {
    // Рассинхронизация portal_section_order() и SECTION_ORDER: раздел
    // существует в коде, но ключа в матрице нет.
    const session = makeSession("head", { candidates: permission(true, true) });
    expect(canViewSection(session, "settings")).toBe(canAccess("head", "settings"));
  });
});
