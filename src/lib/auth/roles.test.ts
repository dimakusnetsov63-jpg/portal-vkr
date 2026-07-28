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
      "candidates",
      "vacancies",
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
  });

  it("оставляет рекрутеру только кандидатов и описание вакансий", () => {
    expect(canAccess("recruiter", "candidates")).toBe(true);
    expect(canAccess("recruiter", "vacancies")).toBe(true);
    expect(canAccess("recruiter", "overview")).toBe(false);
    expect(canAccess("recruiter", "demand")).toBe(false);
    expect(canAccess("recruiter", "marketing")).toBe(false);
    expect(canAccess("recruiter", "analytics")).toBe(false);
    expect(canAccess("recruiter", "settings")).toBe(false);
    expect(canAccess("recruiter", "users")).toBe(false);
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
    // У рекрутера «Обзора» нет — стартовый раздел другой.
    expect(defaultPageForRole("recruiter")).toBe("candidates");
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
