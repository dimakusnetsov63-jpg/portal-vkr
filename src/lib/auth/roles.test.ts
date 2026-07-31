import { describe, expect, it } from "vitest";
import {
  PORTAL_ROLES,
  allowedSections,
  canAccess,
  defaultPageForRole,
  isPortalPage,
  isPortalRole,
} from "./roles";

describe("canAccess — минимальные права из ТЗ", () => {
  it("даёт руководителю все разделы и управление пользователями", () => {
    expect(allowedSections("head")).toEqual([
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
    ]);
    expect(canAccess("head", "users")).toBe(true);
  });

  it("закрывает координатору управление пользователями, оставляя настройки", () => {
    expect(canAccess("coordinator", "settings")).toBe(true);
    expect(canAccess("coordinator", "users")).toBe(false);
  });

  it("закрывает менеджеру настройки, маркетинг и аналитику", () => {
    expect(canAccess("manager", "settings")).toBe(false);
    expect(canAccess("manager", "marketing")).toBe(false);
    expect(canAccess("manager", "analytics")).toBe(false);
    expect(canAccess("manager", "demand")).toBe(true);
    expect(canAccess("manager", "rates")).toBe(true);
  });

  it("оставляет рекрутеру только адреса, кандидатов, описание вакансий, ставки и уведомления", () => {
    expect(canAccess("recruiter", "addresses")).toBe(true);
    expect(canAccess("recruiter", "candidates")).toBe(true);
    expect(canAccess("recruiter", "vacancies")).toBe(true);
    expect(canAccess("recruiter", "rates")).toBe(true);
    expect(canAccess("recruiter", "overview")).toBe(false);
    expect(canAccess("recruiter", "demand")).toBe(false);
    expect(canAccess("recruiter", "marketing")).toBe(false);
    expect(canAccess("recruiter", "analytics")).toBe(false);
    expect(canAccess("recruiter", "settings")).toBe(false);
    expect(canAccess("recruiter", "users")).toBe(false);
  });

  it("даёт «Адреса» и «Ставки» всем четырём ролям, в отличие от большинства разделов", () => {
    const withAddresses = PORTAL_ROLES.filter((role) => canAccess(role, "addresses"));
    expect(withAddresses).toEqual([...PORTAL_ROLES]);
    const withRates = PORTAL_ROLES.filter((role) => canAccess(role, "rates"));
    expect(withRates).toEqual([...PORTAL_ROLES]);
  });

  it("отдаёт управление пользователями только руководителю", () => {
    const withUsers = PORTAL_ROLES.filter((role) => canAccess(role, "users"));
    expect(withUsers).toEqual(["head"]);
  });
});

describe("defaultPageForRole", () => {
  it("ведёт роль на первый доступный ей раздел", () => {
    expect(defaultPageForRole("head")).toBe("overview");
    expect(defaultPageForRole("coordinator")).toBe("overview");
    expect(defaultPageForRole("manager")).toBe("overview");
    // У рекрутера «Обзора» нет — стартовый раздел другой. С добавлением
    // «Адресов» (доступны всем ролям, идут в SECTION_ORDER раньше
    // «Кандидатов») это теперь «Адреса», а не «Кандидаты».
    expect(defaultPageForRole("recruiter")).toBe("addresses");
  });

  it("возвращает раздел, к которому у роли действительно есть доступ", () => {
    for (const role of PORTAL_ROLES) {
      expect(canAccess(role, defaultPageForRole(role))).toBe(true);
    }
  });
});

describe("guards", () => {
  it("не пропускает произвольные строки в роли и разделы", () => {
    expect(isPortalRole("head")).toBe(true);
    expect(isPortalRole("admin")).toBe(false);
    expect(isPortalRole(null)).toBe(false);
    expect(isPortalPage("candidates")).toBe(true);
    expect(isPortalPage("users")).toBe(false);
    expect(isPortalPage(undefined)).toBe(false);
  });
});
