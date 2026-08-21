import { describe, expect, it } from "vitest";
import {
  PORTAL_ROLES,
  allowedSections,
  canAccess,

  isPortalPage,
  isPortalRole,
  type PortalRole,
} from "./roles";

/**
 * Роли, права которых заданы в коде. «ОКК» и «Маркетолог» добавлены позже,
 * когда матрица уже жила в базе, поэтому в ROLE_PERMISSIONS у них пусто —
 * см. отдельную проверку ниже.
 */
const BASELINE_ROLES = ["head", "coordinator", "manager", "recruiter"] as const satisfies readonly PortalRole[];

describe("canAccess — минимальные права из ТЗ", () => {
  it("даёт руководителю все разделы и управление пользователями", () => {
    expect(allowedSections("head")).toEqual([
      "overview",
      "demand",
      "addresses",
      "candidates",
      "vacancies",
      "rates",
      "quality",
      "marketing",
      "analytics",
      "notifications",
      "settings",
    ]);
    expect(canAccess("head", "users")).toBe(true);
  });

  it("даёт «Контроль качества» всем, кроме рекрутёра", () => {
    // Разделение «менеджер читает, но не редактирует» живёт в
    // portal_section_permissions, а не здесь: ROLE_PERMISSIONS отражает
    // только can_view. У рекрутёра раздела нет вовсе — см. комментарий к
    // ROLE_PERMISSIONS и TASK-013.
    expect(canAccess("head", "quality")).toBe(true);
    expect(canAccess("coordinator", "quality")).toBe(true);
    expect(canAccess("manager", "quality")).toBe(true);
    expect(canAccess("recruiter", "quality")).toBe(false);
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

  it("даёт «Адреса» и «Ставки» всем четырём ролям baseline, в отличие от большинства разделов", () => {
    const withAddresses = PORTAL_ROLES.filter((role) => canAccess(role, "addresses"));
    expect(withAddresses).toEqual([...BASELINE_ROLES]);
    const withRates = PORTAL_ROLES.filter((role) => canAccess(role, "rates"));
    expect(withRates).toEqual([...BASELINE_ROLES]);
  });

  it("не даёт «ОКК» и «Маркетологу» ничего: их разделы назначаются в настройках", () => {
    // Роли заведены после перехода на настраиваемые права (миграции
    // 20260821110000/20260821110100), и ROLE_PERMISSIONS для них пуста
    // намеренно — она лишь зеркалит seed, в котором все флаги выключены.
    // Реальные права придут из portal_section_permissions.
    for (const role of ["okk", "marketolog"] as const) {
      expect(allowedSections(role)).toEqual([]);
      expect(canAccess(role, "candidates")).toBe(false);
      expect(canAccess(role, "users")).toBe(false);
    }
  });

  it("отдаёт управление пользователями только руководителю", () => {
    const withUsers = PORTAL_ROLES.filter((role) => canAccess(role, "users"));
    expect(withUsers).toEqual(["head"]);
  });
});

describe("guards", () => {
  it("не пропускает произвольные строки в роли и разделы", () => {
    expect(isPortalRole("head")).toBe(true);
    expect(isPortalRole("okk")).toBe(true);
    expect(isPortalRole("marketolog")).toBe(true);
    expect(isPortalRole("admin")).toBe(false);
    expect(isPortalRole(null)).toBe(false);
    expect(isPortalPage("candidates")).toBe(true);
    expect(isPortalPage("users")).toBe(false);
    expect(isPortalPage(undefined)).toBe(false);
  });
});
