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
 * H-6: candidates.project — прямая колонка, проверяется через
 * portal_has_project(project). Четыре сценария из ТЗ H-13:
 * 1. роль видит только разрешённые проекты;
 * 2. роль не видит чужой проект вообще;
 * 3. роль не может изменить запись чужого проекта;
 * 4. head видит оба проекта сразу.
 */
describe("RLS: candidates — разграничение по проектам (H-6)", () => {
  const marker = testMarker();
  const projectA = `${marker}-A`;
  const projectB = `${marker}-B`;

  let recruiterA: TestPortalUser;
  let head: TestPortalUser;
  let candidateB: { id: string; project: string };

  beforeAll(async () => {
    recruiterA = await createTestPortalUser("recruiter", [projectA], marker);
    // head тоже обязан иметь хотя бы один проект (cardinality > 0), но
    // проверка H-6 для этой роли его игнорирует — значение здесь не влияет
    // на результат, важен сам факт bypass.
    head = await createTestPortalUser("head", [`${marker}-unused`], marker);

    // candidateA не используется напрямую в проверках ниже — она нужна
    // только как данные проекта A, чтобы тесту "видит только свой проект"
    // было что найти.
    await insertTestRow("candidates", { full_name: "Кандидат A", project: projectA });
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

  it("роль не может изменить запись чужого проекта — 403 и код 42501", async () => {
    const response = await asUserFetch(recruiterA.id, `/candidates?id=eq.${candidateB.id}`, {
      method: "PATCH",
      body: JSON.stringify({ full_name: "hacked" }),
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
