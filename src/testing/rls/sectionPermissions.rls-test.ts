import { afterAll, describe, expect, it } from "vitest";
import { PORTAL_ROLES, permissionsForRole, type PortalPermission, type PortalRole } from "@/lib/auth/roles";
import { rlsTestEnv } from "./env";
import { asUserFetch, cleanupTestFixtures, createTestPortalUser, testMarker } from "./client";

/**
 * Третья опора сверки baseline (фаза A): настоящие SQL-функции против
 * матрицы из roles.ts.
 *
 * src/lib/auth/sectionPermissionsSeed.test.ts сверяет seed с roles.ts, читая
 * текст миграции, — этого достаточно, чтобы поймать опечатку в данных, но не
 * достаточно, чтобы поймать ошибку в самих функциях (не тот join, потерянный
 * `project is null`, неверный порядок в array_agg). Здесь проверяется то, что
 * реально вернёт Postgres после применения миграций.
 *
 * Тест не меняет матрицу и ничего в неё не пишет: portal_section_permissions
 * закрыта RLS без политик, править её станет нечем до фазы D.
 */

const baseMarker = testMarker();
let userSeq = 0;

afterAll(async () => {
  // Все логины и проекты этого файла начинаются с baseMarker, а очистка идёт
  // по префиксу (`like.${marker}*`) — одного вызова достаточно.
  await cleanupTestFixtures(baseMarker);
});

/**
 * Учётная запись под конкретный сценарий. Порядковый номер идёт перед
 * названием роли: логин обрезается до 32 символов, и без номера в начале две
 * учётки одной роли из разных тестов схлопнулись бы в один логин, который
 * не пустит уникальный индекс portal_users.
 */
async function makeUser(role: PortalRole, projects: string[] = [`${baseMarker}own`]) {
  const marker = `${baseMarker}${(userSeq++).toString(36)}`;
  return createTestPortalUser(role, projects, marker);
}

async function patchUserAsServiceRole(userId: string, patch: Record<string, unknown>): Promise<void> {
  const key = rlsTestEnv.serviceRoleKey();
  const response = await fetch(`${rlsTestEnv.apiUrl()}/rest/v1/portal_users?id=eq.${userId}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`Не удалось обновить фикстуру ${userId}: ${response.status} ${await response.text()}`);
  }
}

async function callRpcAsAnon<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const key = rlsTestEnv.anonKey();
  const response = await fetch(`${rlsTestEnv.apiUrl()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`RPC ${fn} не отработала: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function callRpcAsUser<T>(userId: string, fn: string, body: Record<string, unknown>): Promise<T> {
  const response = await asUserFetch(userId, `/rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) {
    throw new Error(`RPC ${fn} не отработала: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

describe("portal_role_sections() после переезда на таблицу", () => {
  it.each(PORTAL_ROLES)("роль %s: возвращает ровно то же, что ROLE_PERMISSIONS в roles.ts", async (role) => {
    const sections = await callRpcAsAnon<string[]>("portal_role_sections", { p_role: role });
    // Сравнение массивами, а не множествами: порядок задан
    // portal_section_order() и должен совпасть с порядком меню.
    expect(sections).toEqual([...permissionsForRole(role)]);
  });
});

describe("portal_can_view_section / portal_can_edit_section", () => {
  const probedSections: PortalPermission[] = [
    "overview",
    "demand",
    "addresses",
    "candidates",
    "vacancies",
    "rates",
    "settings",
    "users",
  ];

  it.each(PORTAL_ROLES)("роль %s: VIEW совпадает с матрицей прав", async (role) => {
    const user = await makeUser(role);
    const allowed = new Set<PortalPermission>(permissionsForRole(role));

    for (const section of probedSections) {
      const canView = await callRpcAsUser<boolean>(user.id, "portal_can_view_section", { p_section: section });
      expect(canView, `${role} / ${section}`).toBe(allowed.has(section));
    }
  });

  it("vacancies: читают все четыре роли, редактируют только head и coordinator", async () => {
    const expected: Record<PortalRole, boolean> = {
      head: true,
      coordinator: true,
      manager: false,
      recruiter: false,
    };

    for (const role of PORTAL_ROLES) {
      const user = await makeUser(role);

      const canView = await callRpcAsUser<boolean>(user.id, "portal_can_view_section", { p_section: "vacancies" });
      const canEdit = await callRpcAsUser<boolean>(user.id, "portal_can_edit_section", { p_section: "vacancies" });

      expect(canView, `${role} читает вакансии`).toBe(true);
      expect(canEdit, `${role} редактирует вакансии`).toBe(expected[role]);
    }
  });

  it("portal_can остаётся синонимом VIEW", async () => {
    const user = await makeUser("manager");

    for (const section of ["vacancies", "candidates", "settings"]) {
      const legacy = await callRpcAsUser<boolean>(user.id, "portal_can", { p_section: section });
      const view = await callRpcAsUser<boolean>(user.id, "portal_can_view_section", { p_section: section });
      expect(legacy, section).toBe(view);
    }
  });

  it("отключённый пользователь не проходит ни VIEW, ни EDIT", async () => {
    const user = await makeUser("head");
    await patchUserAsServiceRole(user.id, { is_active: false });

    expect(await callRpcAsUser<boolean>(user.id, "portal_can_view_section", { p_section: "candidates" })).toBe(false);
    expect(await callRpcAsUser<boolean>(user.id, "portal_can_edit_section", { p_section: "candidates" })).toBe(false);
  });
});

describe("portal_has_project() с признаком all_projects", () => {
  it("head видит чужой проект — bypass сохранён", async () => {
    const user = await makeUser("head");
    expect(await callRpcAsUser<boolean>(user.id, "portal_has_project", { p_project: `${baseMarker}foreign` })).toBe(
      true,
    );
  });

  it("обычная роль без all_projects видит только свои проекты", async () => {
    const user = await makeUser("manager");

    expect(await callRpcAsUser<boolean>(user.id, "portal_has_project", { p_project: `${baseMarker}own` })).toBe(true);
    expect(await callRpcAsUser<boolean>(user.id, "portal_has_project", { p_project: `${baseMarker}foreign` })).toBe(
      false,
    );
  });

  it("all_projects = true открывает проект, которого нет в projects", async () => {
    const user = await makeUser("manager");

    expect(await callRpcAsUser<boolean>(user.id, "portal_has_project", { p_project: `${baseMarker}foreign` })).toBe(
      false,
    );

    await patchUserAsServiceRole(user.id, { all_projects: true });

    expect(await callRpcAsUser<boolean>(user.id, "portal_has_project", { p_project: `${baseMarker}foreign` })).toBe(
      true,
    );
  });

  it("у новой учётной записи all_projects = false по умолчанию", async () => {
    const user = await makeUser("recruiter");
    expect(await callRpcAsUser<boolean>(user.id, "portal_has_project", { p_project: `${baseMarker}foreign` })).toBe(
      false,
    );
  });
});

describe("portal_section_permissions закрыта для клиента", () => {
  it("пользователь не может прочитать матрицу напрямую", async () => {
    const user = await makeUser("head");
    const response = await asUserFetch(user.id, "/portal_section_permissions?select=*");
    // Именно отказ в доступе, а не «любая ошибка»: опечатка в имени таблицы
    // дала бы 404, и тест зеленел бы, ничего не проверив (ровно та ловушка,
    // что описана в docs/ROLLOUT-rls-tests.md — зелёный тест хуже
    // отсутствующего).
    expect([401, 403]).toContain(response.status);
  });

  it("пользователь не может выдать себе право", async () => {
    const user = await makeUser("recruiter");
    const response = await asUserFetch(user.id, "/portal_section_permissions?role=eq.recruiter&section=eq.settings", {
      method: "PATCH",
      body: JSON.stringify({ visible: true, can_view: true, can_edit: true }),
    });
    expect([401, 403]).toContain(response.status);

    // И право действительно не появилось.
    expect(await callRpcAsUser<boolean>(user.id, "portal_can_view_section", { p_section: "settings" })).toBe(false);
  });
});
