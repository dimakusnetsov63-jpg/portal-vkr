import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PortalRole } from "@/lib/auth/roles";
import {
  asUserFetch,
  cleanupTestFixtures,
  createTestPortalUser,
  insertTestRow,
  readRowAsServiceRole,
  serviceRoleFetch,
  testMarker,
} from "./client";

/**
 * Негативные тесты фазы C: роль, у которой нет EDIT, не может писать —
 * при том, что VIEW у неё сохранился.
 *
 * Проверяется именно то, что фаза C могла бы незаметно сломать: перевод
 * связки `portal_can(<раздел>) and portal_can('settings')` на новую модель.
 * Если бы запись перевели на can_edit «своего» раздела вместо
 * `settings`-гейта, manager и recruiter получили бы права, которых у них
 * сегодня нет, — и обычные позитивные тесты этого бы не заметили.
 *
 * Важно про коды ответов (см. docs/ROLLOUT-rls-tests.md):
 *   INSERT  → `WITH CHECK` не пропускает → 403 / 42501;
 *   UPDATE  → `USING` не находит строку → 200 и **ноль затронутых строк**,
 *             а не отказ. Поэтому мало проверить код ответа: нужно ещё
 *             перечитать строку в обход RLS и убедиться, что она не
 *             изменилась.
 */

const marker = testMarker();
let userSeq = 0;

const ownProject = `${marker}own`;
const foreignProject = `${marker}foreign`;

async function makeUser(role: PortalRole, projects: string[] = [ownProject]) {
  return createTestPortalUser(role, projects, `${marker}${(userSeq++).toString(36)}`);
}

interface Row {
  id: string;
}

afterAll(async () => {
  // Стандартная очистка не знает про vacancy_* и candidate_list_options —
  // у них нет колонки project, по которой она чистит.
  await serviceRoleFetch(`/vacancy_projects?title=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/candidate_list_options?value=like.${marker}*`, { method: "DELETE" });
  await cleanupTestFixtures(marker);
});

describe("vacancy_*: manager читает, но не пишет", () => {
  let manager: { id: string };
  let head: { id: string };
  let vacancy: Row;
  let section: Row;

  beforeAll(async () => {
    manager = await makeUser("manager");
    head = await makeUser("head");
    vacancy = await insertTestRow<Row>("vacancy_projects", { title: `${marker} вакансия` });
    section = await insertTestRow<Row>("vacancy_sections", {
      vacancy_project_id: vacancy.id,
      title: `${marker} раздел`,
    });
  });

  it("manager видит вакансию (VIEW сохранён)", async () => {
    const response = await asUserFetch(manager.id, `/vacancy_projects?id=eq.${vacancy.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(1);
  });

  it("manager видит раздел вакансии (VIEW сохранён)", async () => {
    const response = await asUserFetch(manager.id, `/vacancy_sections?id=eq.${section.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(1);
  });

  it("manager не может создать раздел — 403 / 42501 (WITH CHECK)", async () => {
    const response = await asUserFetch(manager.id, "/vacancy_sections", {
      method: "POST",
      body: JSON.stringify({ vacancy_project_id: vacancy.id, title: `${marker} чужой раздел` }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("42501");
  });

  it("manager не может переименовать вакансию — строка не меняется (USING)", async () => {
    const response = await asUserFetch(manager.id, `/vacancy_projects?id=eq.${vacancy.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "hacked" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(0);

    const stored = await readRowAsServiceRole<{ title: string }>("vacancy_projects", vacancy.id);
    expect(stored?.title).toBe(`${marker} вакансия`);
  });

  it("manager не может удалить раздел — строка остаётся (USING)", async () => {
    const response = await asUserFetch(manager.id, `/vacancy_sections?id=eq.${section.id}`, { method: "DELETE" });
    expect(response.status).toBe(200);

    const stored = await readRowAsServiceRole<Row>("vacancy_sections", section.id);
    expect(stored?.id).toBe(section.id);
  });

  it("head те же операции выполняет — EDIT сохранён", async () => {
    const created = await asUserFetch(head.id, "/vacancy_sections", {
      method: "POST",
      body: JSON.stringify({ vacancy_project_id: vacancy.id, title: `${marker} раздел head` }),
    });
    expect(created.status).toBe(201);

    const renamed = await asUserFetch(head.id, `/vacancy_projects?id=eq.${vacancy.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: `${marker} вакансия` }),
    });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()) as unknown[]).toHaveLength(1);
  });
});

describe("candidate_list_options: recruiter читает, но не пишет", () => {
  let recruiter: { id: string };
  let option: Row;

  beforeAll(async () => {
    recruiter = await makeUser("recruiter");
    option = await insertTestRow<Row>("candidate_list_options", {
      list_type: "position",
      value: `${marker} должность`,
    });
  });

  it("recruiter видит справочник", async () => {
    const response = await asUserFetch(recruiter.id, `/candidate_list_options?id=eq.${option.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(1);
  });

  it("recruiter не может добавить значение — 403 / 42501", async () => {
    const response = await asUserFetch(recruiter.id, "/candidate_list_options", {
      method: "POST",
      body: JSON.stringify({ list_type: "position", value: `${marker} своя должность` }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("42501");
  });

  it("recruiter не может изменить значение — строка не меняется", async () => {
    const response = await asUserFetch(recruiter.id, `/candidate_list_options?id=eq.${option.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value: "hacked" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(0);

    const stored = await readRowAsServiceRole<{ value: string }>("candidate_list_options", option.id);
    expect(stored?.value).toBe(`${marker} должность`);
  });
});

/**
 * Регресс на боевую жалобу 26 августа 2026: у роли «ОКК» пусты все
 * выпадающие списки формы проверки сразу — проект, сотрудник, возражение,
 * нарушение.
 *
 * Причина была в политике чтения: она требовала VIEW раздела «Кандидаты»,
 * которого у ОКК нет. Справочник при этом общепортальный (TASK-009), его
 * читают шесть разделов, и любая роль без «Кандидатов» упиралась в ноль
 * строк — не в ошибку, поэтому интерфейс честно рисовал пустой список и
 * отличить «нет доступа» от «справочник пуст» не мог.
 *
 * `okk` взята намеренно: в baseline у неё **ноль разделов вообще**. Если
 * условие чтения когда-нибудь снова привяжут к конкретному разделу, этот
 * тест упадёт первым — какой бы раздел ни выбрали.
 */
describe("candidate_list_options: роль без единого раздела всё равно читает справочник", () => {
  let okk: { id: string };
  let option: Row;

  beforeAll(async () => {
    okk = await makeUser("okk");
    option = await insertTestRow<Row>("candidate_list_options", {
      list_type: "project",
      value: `${marker} проект`,
    });
  });

  it("okk видит справочник, хотя разделов у неё нет", async () => {
    const response = await asUserFetch(okk.id, `/candidate_list_options?id=eq.${option.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(1);
  });

  it("okk по-прежнему не может добавить значение — 403 / 42501", async () => {
    const response = await asUserFetch(okk.id, "/candidate_list_options", {
      method: "POST",
      body: JSON.stringify({ list_type: "project", value: `${marker} свой проект` }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("42501");
  });

  it("okk по-прежнему не может изменить значение — строка не меняется", async () => {
    const response = await asUserFetch(okk.id, `/candidate_list_options?id=eq.${option.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value: "hacked" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(0);

    const stored = await readRowAsServiceRole<{ value: string }>("candidate_list_options", option.id);
    expect(stored?.value).toBe(`${marker} проект`);
  });

  it("деактивированный сотрудник справочник не видит", async () => {
    const disabled = await makeUser("okk");
    await serviceRoleFetch(`/portal_users?id=eq.${disabled.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });

    const response = await asUserFetch(disabled.id, `/candidate_list_options?id=eq.${option.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(0);
  });
});

describe("staffing_demand_imports: проектная изоляция (пробел H-6, закрыт в C4)", () => {
  let coordinator: { id: string };
  let headUser: { id: string };
  let ownImport: Row;
  let foreignImport: Row;

  beforeAll(async () => {
    coordinator = await makeUser("coordinator", [ownProject]);
    headUser = await makeUser("head", [ownProject]);

    const base = {
      parser_key: "test_v1",
      parser_version: 1,
      file_name: "test.xlsx",
      mode: "add",
      status: "success",
    };
    ownImport = await insertTestRow<Row>("staffing_demand_imports", { ...base, project: ownProject });
    foreignImport = await insertTestRow<Row>("staffing_demand_imports", { ...base, project: foreignProject });
  });

  it("координатор видит импорт своего проекта", async () => {
    const response = await asUserFetch(coordinator.id, `/staffing_demand_imports?id=eq.${ownImport.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(1);
  });

  it("координатор НЕ видит импорт чужого проекта", async () => {
    const response = await asUserFetch(coordinator.id, `/staffing_demand_imports?id=eq.${foreignImport.id}&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(0);
  });

  it("координатор не может завести импорт в чужом проекте — 403 / 42501", async () => {
    const response = await asUserFetch(coordinator.id, "/staffing_demand_imports", {
      method: "POST",
      body: JSON.stringify({
        project: foreignProject,
        parser_key: "test_v1",
        parser_version: 1,
        file_name: "test.xlsx",
        mode: "add",
        status: "success",
      }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("42501");
  });

  it("head видит импорты обоих проектов — bypass сохранён", async () => {
    const response = await asUserFetch(headUser.id, `/staffing_demand_imports?project=like.${marker}*&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(2);
  });

  it("recruiter не видит импорты вовсе — нет раздела «Настройки»", async () => {
    const recruiter = await makeUser("recruiter", [ownProject]);
    const response = await asUserFetch(recruiter.id, `/staffing_demand_imports?project=like.${marker}*&select=id`);
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).toHaveLength(0);
  });
});
