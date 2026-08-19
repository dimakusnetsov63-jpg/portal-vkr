import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUserFetch,
  cleanupTestFixtures,
  createTestPortalUser,
  insertTestRow,
  readRowAsServiceRole,
  testMarker,
  type TestPortalUser,
} from "./client";

/**
 * Права и целостность раздела «Контроль качества» (TASK-013).
 *
 * До этого набора раздел не был покрыт ни одним тестом прав: unit-тесты
 * проверяли формулу расчёта, а всё, что касается доступа, держалось на
 * чтении миграций глазами. Аудит нашёл в этом месте настоящую дыру (SEC-01),
 * поэтому тесты писались вместе с исправлением и должны падать, если оно
 * когда-нибудь откатится.
 *
 * Проверяется три слоя:
 *   1. политики RLS — кто какие строки видит;
 *   2. гранты — в `quality_reviews` нельзя писать напрямую вообще;
 *   3. тело RPC — гейт по правам, по проекту (обоим!), вид проверки из
 *      шаблона и запрет завершить незаполненную проверку.
 */
describe("RLS: контроль качества — доступ, проекты и целостность RPC", () => {
  const marker = testMarker();
  const projectA = `${marker}-A`;
  const projectB = `${marker}-B`;

  let coordinatorA: TestPortalUser;
  let managerA: TestPortalUser;
  let recruiterA: TestPortalUser;

  let checklistId: string;
  let gateItemId: string;
  let scoredItemId: string;
  let secondScoredItemId: string;
  let reviewInB: { id: string };

  async function callSave(userId: string, body: Record<string, unknown>): Promise<Response> {
    return asUserFetch(userId, "/rpc/portal_save_quality_review", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Полный набор ответов на все три пункта — «завершить» с ним разрешено. */
  function fullScores(): Array<Record<string, unknown>> {
    return [
      { item_id: gateItemId, value: 1, is_na: false },
      { item_id: scoredItemId, value: 2, is_na: false },
      { item_id: secondScoredItemId, value: 1, is_na: false },
    ];
  }

  beforeAll(async () => {
    coordinatorA = await createTestPortalUser("coordinator", [projectA], marker);
    managerA = await createTestPortalUser("manager", [projectA], marker);
    recruiterA = await createTestPortalUser("recruiter", [projectA], marker);

    // Собственный шаблон вместо засеянного общего: тест не должен зависеть
    // от содержимого seed-миграций и не должен их менять.
    const checklist = await insertTestRow<{ id: string }>("quality_checklists", {
      title: `${marker} чек-лист`,
      kind: "call",
      project: projectA,
    });
    checklistId = checklist.id;

    const group = await insertTestRow<{ id: string }>("quality_checklist_groups", {
      checklist_id: checklistId,
      title: "Блок",
      sort_order: 1,
      counts_in_total: true,
    });

    const gate = await insertTestRow<{ id: string }>("quality_checklist_items", {
      group_id: group.id,
      title: "Было возражение?",
      scale: "yes_no",
      sort_order: 1,
    });
    gateItemId = gate.id;

    const first = await insertTestRow<{ id: string }>("quality_checklist_items", {
      group_id: group.id,
      title: "Пункт с баллом",
      scale: "0-1-2",
      sort_order: 2,
    });
    scoredItemId = first.id;

    const second = await insertTestRow<{ id: string }>("quality_checklist_items", {
      group_id: group.id,
      title: "Второй пункт с баллом",
      scale: "0-1-2",
      sort_order: 3,
    });
    secondScoredItemId = second.id;

    // Проверка чужого проекта — цель попыток доступа ниже.
    reviewInB = await insertTestRow<{ id: string }>("quality_reviews", {
      checklist_id: checklistId,
      checklist_version: 1,
      kind: "call",
      crm_lead_id: 555001,
      project: projectB,
      employee_name: "Сотрудник B",
      reviewer_name: "Проверяющий B",
      status: "completed",
    });
  });

  afterAll(async () => {
    await cleanupTestFixtures(marker);
  });

  // --- Чтение -----------------------------------------------------------

  it("координатор не видит проверки чужого проекта", async () => {
    const response = await asUserFetch(coordinatorA.id, `/quality_reviews?id=eq.${reviewInB.id}&select=id`);
    const rows = (await response.json()) as unknown[];
    expect(rows).toHaveLength(0);
  });

  it("рекрутёр не видит проверки вовсе — раздел ему не выдан", async () => {
    const response = await asUserFetch(recruiterA.id, "/quality_reviews?select=id&limit=5");
    const rows = (await response.json()) as unknown[];
    expect(rows).toHaveLength(0);
  });

  it("рекрутёр не видит и шаблоны проверок", async () => {
    const response = await asUserFetch(recruiterA.id, `/quality_checklists?id=eq.${checklistId}&select=id`);
    const rows = (await response.json()) as unknown[];
    expect(rows).toHaveLength(0);
  });

  // --- Прямая запись мимо RPC -------------------------------------------

  it("прямой INSERT в quality_reviews отвергается даже у координатора", async () => {
    // У таблицы нет ни INSERT-политики, ни гранта: единственный путь
    // записи — portal_save_quality_review, которая считает проценты сама.
    const response = await asUserFetch(coordinatorA.id, "/quality_reviews", {
      method: "POST",
      body: JSON.stringify({
        checklist_id: checklistId,
        checklist_version: 1,
        kind: "call",
        crm_lead_id: 555002,
        project: projectA,
        employee_name: "Попытка",
        reviewer_name: "Попытка",
        total_score: 100,
      }),
    });
    expect(response.status).toBe(403);
  });

  it("прямой UPDATE quality_reviews отвергается — итог нельзя переписать в обход расчёта", async () => {
    const response = await asUserFetch(coordinatorA.id, `/quality_reviews?id=eq.${reviewInB.id}`, {
      method: "PATCH",
      body: JSON.stringify({ total_score: 100 }),
    });
    expect(response.status).toBe(403);
  });

  // --- Права на RPC ------------------------------------------------------

  it("менеджер читает раздел, но сохранить проверку не может", async () => {
    const response = await callSave(managerA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555003,
        project: projectA,
        employee_name: "Сотрудник A",
        scores: fullScores(),
      },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("42501");
  });

  it("координатор не может создать проверку в чужом проекте", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555004,
        project: projectB,
        employee_name: "Сотрудник B",
        scores: fullScores(),
      },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("42501");
  });

  it("SEC-01: координатор не может обновить проверку чужого проекта, зная её id", async () => {
    // Ключевой регресс-тест фазы A: до 20260819110000 проверялся только
    // проект из payload, поэтому чужую проверку можно было переписать и
    // заодно перенести в свой проект.
    const response = await callSave(coordinatorA.id, {
      p_review_id: reviewInB.id,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 999999,
        project: projectA,
        employee_name: "Подмена",
        scores: fullScores(),
      },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("42501");

    const untouched = await readRowAsServiceRole<{ project: string; employee_name: string; crm_lead_id: number }>(
      "quality_reviews",
      reviewInB.id,
    );
    expect(untouched?.project).toBe(projectB);
    expect(untouched?.employee_name).toBe("Сотрудник B");
    expect(Number(untouched?.crm_lead_id)).toBe(555001);
  });

  // --- Целостность данных ------------------------------------------------

  it("BUG-01: завершить проверку с незаполненными пунктами нельзя", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555005,
        project: projectA,
        employee_name: "Сотрудник A",
        status: "completed",
        // Отвечен только переключатель — два пункта с баллами пропущены.
        scores: [{ item_id: gateItemId, value: 1, is_na: false }],
      },
    });
    expect(response.ok).toBe(false);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("P0001");
    expect(body.message).toContain("не заполнено");
  });

  it("черновик с пропусками сохранить можно — незаконченную проверку нужно уметь отложить", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555006,
        project: projectA,
        employee_name: "Сотрудник A",
        status: "draft",
        scores: [{ item_id: gateItemId, value: 1, is_na: false }],
      },
    });
    expect(response.ok).toBe(true);
  });

  it("выключенный переключателем блок не требует заполнения", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555007,
        project: projectA,
        employee_name: "Сотрудник A",
        status: "completed",
        // «Возражения не было» — остальные пункты блока заполнять не нужно.
        scores: [{ item_id: gateItemId, value: 0, is_na: false }],
      },
    });
    expect(response.ok).toBe(true);
    const saved = (await response.json()) as { total_score: number | null };
    // Единственный блок выключен, считать нечего — прочерк, а не ноль.
    expect(saved.total_score).toBeNull();
  });

  it("SEC-02: вид проверки берётся из шаблона, а не из payload", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        kind: "refusal", // шаблон — 'call'; значение из payload обязано игнорироваться
        crm_lead_id: 555008,
        project: projectA,
        employee_name: "Сотрудник A",
        status: "completed",
        scores: fullScores(),
      },
    });
    expect(response.ok).toBe(true);
    const saved = (await response.json()) as { id: string };

    const stored = await readRowAsServiceRole<{ kind: string }>("quality_reviews", saved.id);
    expect(stored?.kind).toBe("call");
  });

  it("итог считает база: присланный клиентом total_score игнорируется", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555009,
        project: projectA,
        employee_name: "Сотрудник A",
        status: "completed",
        total_score: 100,
        scores: fullScores(),
      },
    });
    expect(response.ok).toBe(true);
    const saved = (await response.json()) as { total_score: string | number };
    // Балл 2 и балл 1 при максимуме 2 у каждого: (2+1)/(2*2) = 75%.
    expect(Number(saved.total_score)).toBe(75);
  });

  it("пункт чужого шаблона в payload отвергается", async () => {
    const otherChecklist = await insertTestRow<{ id: string }>("quality_checklists", {
      title: `${marker} чужой`,
      kind: "call",
      project: `${projectA}-other`,
    });
    const otherGroup = await insertTestRow<{ id: string }>("quality_checklist_groups", {
      checklist_id: otherChecklist.id,
      title: "Чужой блок",
      sort_order: 1,
    });
    const otherItem = await insertTestRow<{ id: string }>("quality_checklist_items", {
      group_id: otherGroup.id,
      title: "Чужой пункт",
      scale: "0-2",
      sort_order: 1,
    });

    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555010,
        project: projectA,
        employee_name: "Сотрудник A",
        status: "draft",
        scores: [{ item_id: otherItem.id, value: 2, is_na: false }],
      },
    });
    expect(response.ok).toBe(false);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("P0001");
  });

  // --- Шаблоны -----------------------------------------------------------

  it("менеджер не может править шаблон проверки", async () => {
    const response = await asUserFetch(managerA.id, `/quality_checklist_items?id=eq.${scoredItemId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Переписано менеджером" }),
    });
    // Политика UPDATE требует can_edit('quality'); у manager его нет.
    expect([403, 404]).toContain(response.status);

    const untouched = await readRowAsServiceRole<{ title: string }>("quality_checklist_items", scoredItemId);
    expect(untouched?.title).toBe("Пункт с баллом");
  });

  it("SEC-03: слишком длинное значение отвергается ограничением базы", async () => {
    const response = await callSave(coordinatorA.id, {
      p_review_id: null,
      p_payload: {
        checklist_id: checklistId,
        crm_lead_id: 555011,
        project: projectA,
        employee_name: "x".repeat(201),
        status: "draft",
        scores: [],
      },
    });
    expect(response.ok).toBe(false);
  });
});
