import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PortalRole } from "@/lib/auth/roles";
import { asUserFetch, cleanupTestFixtures, createTestPortalUser, testMarker } from "./client";

/**
 * Админские RPC фазы D: чтение и правка матрицы прав, выдача проектов.
 *
 * Главное, что здесь проверяется, — гейт. Все три функции SECURITY DEFINER,
 * то есть обходят RLS полностью: если проверка внутри тела не сработает,
 * любой вошедший сможет выдать своей роли что угодно. Политики таблицы тут
 * не помогут — у `portal_section_permissions` их нет вовсе.
 *
 * ВАЖНО про изоляцию. Матрица прав одна на всю базу, «своей строки на тест»
 * у неё нет, поэтому тесты правки работают с глобальным состоянием и
 * возвращают его обратно в `afterAll`. Параллельный прогон файлов отключён
 * (`fileParallelism: false` в vitest.rls.config.ts) — иначе соседний файл
 * увидел бы матрицу изменённой и упал на сверке baseline.
 *
 * Правится ячейка `manager` × `marketing`: в baseline она полностью
 * выключена, и ни одна политика RLS раздел «Маркетинг» не проверяет — то
 * есть правка не меняет доступ ни к одной таблице, даже пока идёт тест.
 */

const marker = testMarker();
let userSeq = 0;

const TARGET_ROLE: PortalRole = "manager";
const TARGET_SECTION = "marketing";
const BASELINE = { visible: false, can_view: false, can_edit: false };

async function makeUser(role: PortalRole) {
  return createTestPortalUser(role, [`${marker}p`], `${marker}${(userSeq++).toString(36)}`);
}

async function rpc(userId: string, fn: string, body: Record<string, unknown> = {}) {
  return asUserFetch(userId, `/rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });
}

let head: { id: string };

beforeAll(async () => {
  head = await makeUser("head");
});

afterAll(async () => {
  // Вернуть ячейку в baseline до того, как начнутся остальные файлы.
  await rpc(head.id, "portal_admin_set_section_permission", {
    p_role: TARGET_ROLE,
    p_section: TARGET_SECTION,
    p_visible: BASELINE.visible,
    p_can_view: BASELINE.can_view,
    p_can_edit: BASELINE.can_edit,
  });
  await cleanupTestFixtures(marker);
});

describe("гейт: матрицу правит только head", () => {
  it.each(["coordinator", "manager", "recruiter"] as PortalRole[])(
    "%s не может прочитать матрицу — 42501",
    async (role) => {
      const user = await makeUser(role);
      const response = await rpc(user.id, "portal_admin_list_section_permissions");
      expect(response.status).toBe(403);
      expect(((await response.json()) as { code: string }).code).toBe("42501");
    },
  );

  it.each(["coordinator", "manager", "recruiter"] as PortalRole[])(
    "%s не может изменить право — 42501",
    async (role) => {
      const user = await makeUser(role);
      const response = await rpc(user.id, "portal_admin_set_section_permission", {
        p_role: role,
        p_section: "settings",
        p_visible: true,
        p_can_view: true,
        p_can_edit: true,
      });
      expect(response.status).toBe(403);
      expect(((await response.json()) as { code: string }).code).toBe("42501");
    },
  );

  it("отключённый head тоже не проходит — проверяется is_active, а не только роль", async () => {
    const disabled = await makeUser("head");
    await asUserFetch(head.id, `/rpc/portal_admin_set_user_active`, {
      method: "POST",
      body: JSON.stringify({ p_user_id: disabled.id, p_is_active: false }),
    });
    const response = await rpc(disabled.id, "portal_admin_list_section_permissions");
    expect(response.status).toBe(403);
  });

  it("head читает матрицу: 44 строки", async () => {
    const response = await rpc(head.id, "portal_admin_list_section_permissions");
    expect(response.status).toBe(200);
    const rows = (await response.json()) as unknown[];
    expect(rows).toHaveLength(44);
  });
});

describe("изменение права", () => {
  it("head включает раздел, и это видно в portal_role_sections", async () => {
    const before = await rpc(head.id, "portal_role_sections", { p_role: TARGET_ROLE });
    expect((await before.json()) as string[]).not.toContain(TARGET_SECTION);

    const response = await rpc(head.id, "portal_admin_set_section_permission", {
      p_role: TARGET_ROLE,
      p_section: TARGET_SECTION,
      p_visible: true,
      p_can_view: true,
      p_can_edit: false,
    });
    expect(response.status).toBe(200);

    const after = await rpc(head.id, "portal_role_sections", { p_role: TARGET_ROLE });
    expect((await after.json()) as string[]).toContain(TARGET_SECTION);
  });

  it("изменение попало в журнал с «было → стало»", async () => {
    const response = await asUserFetch(head.id, "/rpc/portal_admin_list_audit", {
      method: "POST",
      body: JSON.stringify({ p_limit: 50 }),
    });
    const entries = (await response.json()) as {
      action: string;
      details: { role?: string; section?: string; from?: unknown; to?: unknown };
    }[];
    const entry = entries.find(
      (e) => e.action === "section_permission_changed" && e.details.section === TARGET_SECTION,
    );
    expect(entry).toBeDefined();
    expect(entry?.details.from).toEqual({ visible: false, can_view: false, can_edit: false });
    expect(entry?.details.to).toEqual({ visible: true, can_view: true, can_edit: false });
  });
});

describe("инварианты и защита от самоблокировки", () => {
  it("can_edit без can_view отклоняется", async () => {
    const response = await rpc(head.id, "portal_admin_set_section_permission", {
      p_role: TARGET_ROLE,
      p_section: TARGET_SECTION,
      p_visible: true,
      p_can_view: false,
      p_can_edit: true,
    });
    expect(response.status).toBe(400);
  });

  it("can_view без visible отклоняется", async () => {
    const response = await rpc(head.id, "portal_admin_set_section_permission", {
      p_role: TARGET_ROLE,
      p_section: TARGET_SECTION,
      p_visible: false,
      p_can_view: true,
      p_can_edit: false,
    });
    expect(response.status).toBe(400);
  });

  it("неизвестный раздел отклоняется", async () => {
    const response = await rpc(head.id, "portal_admin_set_section_permission", {
      p_role: TARGET_ROLE,
      p_section: "not_a_section",
      p_visible: true,
      p_can_view: true,
      p_can_edit: true,
    });
    expect(response.status).toBe(400);
  });

  it.each(["settings", "users"])(
    "head не может отобрать у себя раздел «%s» — иначе управление доступами станет недостижимым",
    async (section) => {
      const response = await rpc(head.id, "portal_admin_set_section_permission", {
        p_role: "head",
        p_section: section,
        p_visible: false,
        p_can_view: false,
        p_can_edit: false,
      });
      expect(response.status).toBe(400);

      // И право на месте — отказ произошёл до записи.
      const sections = await rpc(head.id, "portal_role_sections", { p_role: "head" });
      expect((await sections.json()) as string[]).toContain(section);
    },
  );
});

describe("проекты пользователя", () => {
  it("head выдаёт «все проекты» с пустым списком", async () => {
    const target = await makeUser("recruiter");
    const response = await rpc(head.id, "portal_admin_set_user_projects", {
      p_user_id: target.id,
      p_projects: [],
      p_all_projects: true,
    });
    expect(response.status).toBe(200);
    const user = (await response.json()) as { all_projects: boolean; projects: string[] };
    expect(user.all_projects).toBe(true);
    expect(user.projects).toEqual([]);
  });

  it("пустой список без «всех проектов» отклоняется", async () => {
    const target = await makeUser("recruiter");
    const response = await rpc(head.id, "portal_admin_set_user_projects", {
      p_user_id: target.id,
      p_projects: [],
      p_all_projects: false,
    });
    expect(response.status).toBe(400);
  });

  it("не-head не может выдать себе проекты — 42501", async () => {
    const user = await makeUser("coordinator");
    const response = await rpc(user.id, "portal_admin_set_user_projects", {
      p_user_id: user.id,
      p_projects: [],
      p_all_projects: true,
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("42501");
  });
});

describe("payload пользователя", () => {
  it("portal_admin_list_users отдаёт all_projects и permissions", async () => {
    const response = await rpc(head.id, "portal_admin_list_users");
    expect(response.status).toBe(200);
    const users = (await response.json()) as {
      all_projects: boolean;
      permissions: Record<string, { visible: boolean; can_view: boolean; can_edit: boolean }>;
    }[];
    expect(users.length).toBeGreaterThan(0);

    const sample = users[0];
    expect(typeof sample.all_projects).toBe("boolean");
    // Ключи есть для всех 11 прав, включая недоступные роли.
    expect(Object.keys(sample.permissions)).toHaveLength(11);
    expect(sample.permissions.candidates).toHaveProperty("can_edit");
  });
});
