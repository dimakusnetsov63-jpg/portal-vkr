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
 * H-6: candidates.project — прямая колонка, проверяется через
 * portal_has_project(project).
 *
 * Важное различие, которое здесь проверяется двумя отдельными тестами, а не
 * одним: RLS защищает запись двумя механизмами, и выглядят они по-разному.
 * `USING` решает, какие строки пользователь **видит** — чужая строка просто
 * невидима, поэтому `UPDATE` по ней возвращает обычный `200` и ноль
 * изменённых строк, а не отказ. `WITH CHECK` решает, какие значения можно
 * **записать** — вот он и даёт `403`/`42501`. Первая версия этого файла
 * смешивала их (ждала 403 от сценария, который упирается в `USING`) и
 * падала, хотя защита работала.
 */
describe("RLS: candidates — разграничение по проектам (H-6)", () => {
  const marker = testMarker();
  const projectA = `${marker}-A`;
  const projectB = `${marker}-B`;

  let recruiterA: TestPortalUser;
  let head: TestPortalUser;
  let candidateA: { id: string; project: string };
  let candidateB: { id: string; project: string };

  beforeAll(async () => {
    recruiterA = await createTestPortalUser("recruiter", [projectA], marker);
    // head тоже обязан иметь хотя бы один проект (cardinality > 0), но
    // проверка H-6 для этой роли его игнорирует — значение здесь не влияет
    // на результат, важен сам факт bypass.
    head = await createTestPortalUser("head", [`${marker}-unused`], marker);

    candidateA = await insertTestRow("candidates", { full_name: "Кандидат A", project: projectA });
    candidateB = await insertTestRow("candidates", { full_name: "Кандидат B", project: projectB });
  });

  afterAll(async () => {
    await cleanupTestFixtures(marker);
  });

  it("роль видит только разрешённые проекты", async () => {
    const response = await asUserFetch(recruiterA.id, `/candidates?select=project&project=in.(${projectA},${projectB})`);
    const rows = (await response.json()) as { project: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.project === projectA)).toBe(true);
  });

  it("роль не видит чужой проект вообще, не просто «список короче»", async () => {
    const response = await asUserFetch(recruiterA.id, `/candidates?project=eq.${projectB}&select=id`);
    const rows = (await response.json()) as unknown[];
    expect(rows).toHaveLength(0);
  });

  it("UPDATE чужой записи не меняет её (USING — строка невидима, ноль затронутых строк)", async () => {
    const response = await asUserFetch(recruiterA.id, `/candidates?id=eq.${candidateB.id}`, {
      method: "PATCH",
      body: JSON.stringify({ full_name: "hacked" }),
    });
    // Не 403: `USING` не отказывает, а скрывает — PostgREST честно
    // отвечает «обновлено ноль строк». Проверять только код ответа здесь
    // недостаточно, поэтому ниже смотрим саму запись в обход RLS.
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(0);

    const stored = await readRowAsServiceRole<{ full_name: string }>("candidates", candidateB.id);
    expect(stored?.full_name).toBe("Кандидат B");
  });

  it("перенос своей записи в чужой проект отклоняется — 403 и код 42501 (WITH CHECK)", async () => {
    const response = await asUserFetch(recruiterA.id, `/candidates?id=eq.${candidateA.id}`, {
      method: "PATCH",
      body: JSON.stringify({ project: projectB }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("42501");

    const stored = await readRowAsServiceRole<{ project: string }>("candidates", candidateA.id);
    expect(stored?.project).toBe(projectA);
  });

  it("INSERT в чужой проект отклоняется — 403 и код 42501 (WITH CHECK)", async () => {
    const response = await asUserFetch(recruiterA.id, "/candidates", {
      method: "POST",
      body: JSON.stringify({ full_name: "Попытка", project: projectB }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("42501");
  });

  it("head видит оба проекта сразу, независимо от своего portal_users.projects", async () => {
    const response = await asUserFetch(head.id, `/candidates?select=project&project=in.(${projectA},${projectB})`);
    const rows = (await response.json()) as { project: string }[];
    const projects = new Set(rows.map((r) => r.project));
    expect(projects.has(projectA)).toBe(true);
    expect(projects.has(projectB)).toBe(true);
  });
});
