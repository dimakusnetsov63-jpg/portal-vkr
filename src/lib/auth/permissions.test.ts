import { describe, expect, it } from "vitest";
import {
  canEditSection,
  canViewSection,
  firstViewableSection,
  isSectionVisible,
  normalizePermission,
  visibleSections,
} from "./permissions";
import type { PortalPage } from "@/lib/portal/types";
import type { SectionPermissions } from "@/lib/supabase/portalAuth.types";

const ORDER: PortalPage[] = [
  "overview",
  "demand",
  "addresses",
  "candidates",
  "vacancies",
  "rates",
  "marketing",
  "analytics",
  "notifications",
  "settings",
];

function p(visible: boolean, canView: boolean, canEdit: boolean) {
  return { visible, can_view: canView, can_edit: canEdit };
}

describe("чтение матрицы", () => {
  const permissions: SectionPermissions = {
    candidates: p(true, true, true),
    analytics: p(true, true, false),
    marketing: p(false, false, false),
  };

  it("различает три уровня", () => {
    expect(canEditSection(permissions, "candidates")).toBe(true);
    expect(canEditSection(permissions, "analytics")).toBe(false);
    expect(canViewSection(permissions, "analytics")).toBe(true);
    expect(canViewSection(permissions, "marketing")).toBe(false);
  });

  it("раздел, которого нет в матрице, считается закрытым", () => {
    // Рассинхронизация portal_section_order() и SECTION_ORDER не должна
    // оборачиваться доступом «по умолчанию».
    expect(isSectionVisible(permissions, "settings")).toBe(false);
    expect(canViewSection(permissions, "settings")).toBe(false);
    expect(canEditSection(permissions, "settings")).toBe(false);
  });

  it("матрицы нет вовсе — всё закрыто, без исключений", () => {
    expect(canViewSection(undefined, "candidates")).toBe(false);
    expect(canEditSection(undefined, "candidates")).toBe(false);
    expect(isSectionVisible(undefined, "candidates")).toBe(false);
  });
});

describe("меню", () => {
  it("сохраняет порядок NAV_ITEMS, а не порядок ключей матрицы", () => {
    const permissions: SectionPermissions = {
      settings: p(true, true, true),
      overview: p(true, true, true),
      candidates: p(true, true, true),
    };
    expect(visibleSections(permissions, ORDER)).toEqual(["overview", "candidates", "settings"]);
  });

  it("скрытый раздел выпадает из меню, даже если его можно открыть", () => {
    // visible = false при can_view = true — законное сочетание: пункт убран
    // из навигации, но прямая ссылка работает.
    const permissions: SectionPermissions = {
      overview: p(true, true, false),
      analytics: p(false, true, false),
    };
    expect(visibleSections(permissions, ORDER)).toEqual(["overview"]);
    expect(canViewSection(permissions, "analytics")).toBe(true);
  });
});

describe("стартовый раздел", () => {
  it("первый доступный в порядке меню", () => {
    const permissions: SectionPermissions = {
      overview: p(false, false, false),
      demand: p(false, false, false),
      addresses: p(true, true, true),
      candidates: p(true, true, true),
    };
    expect(firstViewableSection(permissions, ORDER)).toBe("addresses");
  });

  it("выбирается по can_view, а не по visible", () => {
    // Раздел скрыт из меню, но открывается — на него и приземляемся, если
    // раньше в порядке ничего доступного нет.
    const permissions: SectionPermissions = { demand: p(false, true, false) };
    expect(firstViewableSection(permissions, ORDER)).toBe("demand");
  });

  it("нет доступных разделов — undefined, а не первый попавшийся", () => {
    expect(firstViewableSection({}, ORDER)).toBeUndefined();
    expect(firstViewableSection(undefined, ORDER)).toBeUndefined();
  });
});

describe("нормализация переключателей (§11 ТЗ)", () => {
  it("выключение просмотра гасит редактирование", () => {
    expect(normalizePermission(p(true, false, true))).toEqual(p(true, false, false));
  });

  it("выключение видимости гасит и просмотр, и редактирование", () => {
    expect(normalizePermission(p(false, true, true))).toEqual(p(false, false, false));
  });

  it("валидные сочетания не трогает", () => {
    expect(normalizePermission(p(true, true, true))).toEqual(p(true, true, true));
    expect(normalizePermission(p(true, true, false))).toEqual(p(true, true, false));
    expect(normalizePermission(p(true, false, false))).toEqual(p(true, false, false));
    expect(normalizePermission(p(false, false, false))).toEqual(p(false, false, false));
  });

  it("результат всегда удовлетворяет инварианту can_edit => can_view => visible", () => {
    for (const visible of [true, false]) {
      for (const canView of [true, false]) {
        for (const canEdit of [true, false]) {
          const result = normalizePermission(p(visible, canView, canEdit));
          if (result.can_edit) expect(result.can_view).toBe(true);
          if (result.can_view) expect(result.visible).toBe(true);
        }
      }
    }
  });
});
