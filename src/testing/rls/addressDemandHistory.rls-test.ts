import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUserFetch,
  cleanupTestFixtures,
  createTestPortalUser,
  insertTestRow,
  testMarker,
  type TestPortalUser,
} from "./client";

/**
 * `address_demand_history` + `staffing_demand_effective()` — 20260807100300.
 *
 * Два предмета проверки в одном файле, потому что они физически не
 * разделимы: RLS на таблице — это то, что действительно защищает данные;
 * поведение функции — это то, что раздел «Потребность» реально видит. Тест
 * только на unit-уровне (`demandMetrics.test.ts`, `demandHistoryPlan.test.ts`)
 * не мог бы поймать ни ошибку в самих политиках (write-аудитория ýже
 * read-аудитории, project-scoping), ни ошибку в SQL FULL OUTER JOIN
 * (COALESCE, победа истории при коллизии ключа, SUM с нулями) — они
 * выполняются только на настоящем Postgres/PostgREST.
 */
describe("RLS + RPC: address_demand_history / staffing_demand_effective (20260807100300)", () => {
  const marker = testMarker();
  const projectA = `${marker}-A`;
  const projectB = `${marker}-B`;
  const dateWithHistory = "2026-08-05";
  const dateManualOnly = "2026-08-06";

  let head: TestPortalUser;
  let coordinatorA: TestPortalUser;
  let managerA: TestPortalUser;
  let recruiterA: TestPortalUser;
  let addressA1: { id: string };
  let addressA2: { id: string };
  let addressB1: { id: string };
  let historyRowB: { id: string };

  beforeAll(async () => {
    head = await createTestPortalUser("head", [`${marker}-unused`], marker);
    coordinatorA = await createTestPortalUser("coordinator", [projectA], marker);
    managerA = await createTestPortalUser("manager", [projectA], marker);
    recruiterA = await createTestPortalUser("recruiter", [projectA], marker);

    addressA1 = await insertTestRow("addresses", {
      project: projectA,
      city: "Москва",
      full_address: `${marker} Снежная 20`,
      position: "Курьер",
      source: "excel",
    });
    addressA2 = await insertTestRow("addresses", {
      project: projectA,
      city: "Москва",
      full_address: `${marker} Снежная 21`,
      position: "Курьер",
      source: "excel",
    });
    addressB1 = await insertTestRow("addresses", {
      project: projectB,
      city: "Казань",
      full_address: `${marker} Спутник 1`,
      position: "Курьер",
      source: "excel",
    });

    // На один и тот же ключ (project A, Москва, Курьер, dateWithHistory) —
    // два адреса, 100 + 0: проверяет и SUM по нескольким адресам (сценарий
    // "9"), и то, что явный ноль не выпадает из суммы и не подменяется
    // пустым результатом (сценарий "8" — coalesce в SQL различает NULL и 0).
    await insertTestRow("address_demand_history", {
      address_id: addressA1.id,
      project: projectA,
      city: "Москва",
      position: "Курьер",
      demand_date: dateWithHistory,
      required_count: 100,
    });
    await insertTestRow("address_demand_history", {
      address_id: addressA2.id,
      project: projectA,
      city: "Москва",
      position: "Курьер",
      demand_date: dateWithHistory,
      required_count: 0,
    });

    // Ручная строка на ТОТ ЖЕ ключ и дату — проверяет, что история побеждает
    // при коллизии (source становится 'excel', а не 'manual', значение —
    // сумма истории 100, а не ручные 999).
    await insertTestRow("staffing_demand", {
      project: projectA,
      city: "Москва",
      position: "Курьер",
      demand_date: dateWithHistory,
      planned_count: 999,
    });

    // Ручная строка на дату/ключ, для которого истории вообще нет — должна
    // остаться видимой как обычно (сценарий "10": ручная потребность без
    // Excel-истории не исчезает).
    await insertTestRow("staffing_demand", {
      project: projectA,
      city: "Москва",
      position: "Кассир",
      demand_date: dateManualOnly,
      planned_count: 7,
    });

    // Проект B — для проверки project-scoping через RLS внутри самой
    // функции (не только через .from(), но и через .rpc()).
    historyRowB = await insertTestRow("address_demand_history", {
      address_id: addressB1.id,
      project: projectB,
      city: "Казань",
      position: "Курьер",
      demand_date: dateWithHistory,
      required_count: 50,
    });
  });

  afterAll(async () => {
    await cleanupTestFixtures(marker);
  });

  describe("RLS на таблице address_demand_history", () => {
    it("координатор (demand+addresses+settings) читает историю своего проекта", async () => {
      const response = await asUserFetch(
        coordinatorA.id,
        `/address_demand_history?project=eq.${projectA}&select=id,required_count`,
      );
      const rows = (await response.json()) as { required_count: number }[];
      expect(rows.length).toBe(2);
    });

    it("менеджер (только demand, без settings) читает историю, но не может её писать", async () => {
      const readResponse = await asUserFetch(managerA.id, `/address_demand_history?project=eq.${projectA}&select=id`);
      expect((await readResponse.json())).toHaveLength(2);

      const writeResponse = await asUserFetch(managerA.id, "/address_demand_history", {
        method: "POST",
        body: JSON.stringify({
          address_id: addressA1.id,
          project: projectA,
          city: "Москва",
          position: "Курьер",
          demand_date: "2026-08-08",
          required_count: 1,
        }),
      });
      expect(writeResponse.status).toBe(403);
      const body = (await writeResponse.json()) as { code: string };
      expect(body.code).toBe("42501");
    });

    it("рекрутёр (нет demand) не видит историю вообще, хотя видит сам раздел «Адреса»", async () => {
      const response = await asUserFetch(recruiterA.id, `/address_demand_history?project=eq.${projectA}&select=id`);
      expect(await response.json()).toHaveLength(0);
    });

    it("координатор проекта A не видит и не может изменить историю проекта B", async () => {
      const readResponse = await asUserFetch(coordinatorA.id, `/address_demand_history?project=eq.${projectB}&select=id`);
      expect(await readResponse.json()).toHaveLength(0);

      const deleteResponse = await asUserFetch(coordinatorA.id, `/address_demand_history?id=eq.${historyRowB.id}`, {
        method: "DELETE",
      });
      // USING скрывает чужую строку — PostgREST отвечает "успех, 0 строк",
      // не 403 (тот же паттерн, что в candidates.rls-test.ts).
      expect(deleteResponse.status).toBe(200);
      expect(await deleteResponse.json()).toHaveLength(0);
    });

    it("координатор проекта A не может завести историю на проект B, даже имея addresses+settings (WITH CHECK — portal_has_project)", async () => {
      // Регрессия, которую поймала бы отсутствующая project-скоупинг: без
      // portal_has_project(project) в insert/update/delete координатор с
      // правами addresses+settings мог бы писать историю ЛЮБОГО проекта, не
      // только своего — хотя сами карточки addresses чужого проекта ему уже
      // недоступны (см. schema.md, прецедент — addresses, не
      // staffing_demand_imports).
      const response = await asUserFetch(coordinatorA.id, "/address_demand_history", {
        method: "POST",
        body: JSON.stringify({
          address_id: addressB1.id,
          project: projectB,
          city: "Казань",
          position: "Курьер",
          demand_date: "2026-08-09",
          required_count: 1,
        }),
      });
      expect(response.status).toBe(403);
      const body = (await response.json()) as { code: string };
      expect(body.code).toBe("42501");
    });

    it("head видит историю обоих проектов сразу", async () => {
      const response = await asUserFetch(
        head.id,
        `/address_demand_history?select=project&project=in.(${projectA},${projectB})`,
      );
      const rows = (await response.json()) as { project: string }[];
      const projects = new Set(rows.map((r) => r.project));
      expect(projects.has(projectA)).toBe(true);
      expect(projects.has(projectB)).toBe(true);
    });
  });

  describe("RPC staffing_demand_effective()", () => {
    async function callEffective(userId: string) {
      const response = await asUserFetch(userId, "/rpc/staffing_demand_effective", {
        method: "POST",
        body: JSON.stringify({ p_from: dateWithHistory, p_to: dateManualOnly }),
      });
      expect(response.status).toBe(200);
      return (await response.json()) as {
        project: string;
        city: string;
        position: string;
        demand_date: string;
        planned_count: number;
        source: string;
      }[];
    }

    it("суммирует несколько адресов истории (включая явный ноль) и помечает ключ как excel", async () => {
      const rows = await callEffective(coordinatorA.id);
      const row = rows.find((r) => r.project === projectA && r.position === "Курьер" && r.demand_date === dateWithHistory);
      expect(row).toBeDefined();
      expect(row!.planned_count).toBe(100); // 100 + 0, не 999 из ручной строки
      expect(row!.source).toBe("excel");
    });

    it("ручная строка без истории на другую дату остаётся видимой как manual", async () => {
      const rows = await callEffective(coordinatorA.id);
      const row = rows.find((r) => r.project === projectA && r.position === "Кассир" && r.demand_date === dateManualOnly);
      expect(row).toBeDefined();
      expect(row!.planned_count).toBe(7);
      expect(row!.source).toBe("manual");
    });

    it("проект B не просачивается в результат для пользователя без доступа к нему", async () => {
      const rows = await callEffective(coordinatorA.id);
      expect(rows.some((r) => r.project === projectB)).toBe(false);
    });

    it("head в том же вызове видит и проект A, и проект B", async () => {
      const rows = await callEffective(head.id);
      expect(rows.some((r) => r.project === projectA && r.planned_count === 100)).toBe(true);
      expect(rows.some((r) => r.project === projectB && r.planned_count === 50)).toBe(true);
    });

    it("рекрутёр (нет 'demand') получает пустой результат, а не ошибку — RLS отфильтровала строки внутри функции, не заблокировала вызов", async () => {
      const response = await asUserFetch(recruiterA.id, "/rpc/staffing_demand_effective", {
        method: "POST",
        body: JSON.stringify({ p_from: dateWithHistory, p_to: dateManualOnly }),
      });
      expect(response.status).toBe(200);
      const rows = (await response.json()) as unknown[];
      expect(rows.filter((r) => (r as { project: string }).project === projectA)).toHaveLength(0);
    });
  });
});
