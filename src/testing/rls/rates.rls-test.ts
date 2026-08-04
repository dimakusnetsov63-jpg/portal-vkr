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
 * H-6: `rates` не имеет собственной колонки `project` — проверяется через
 * `portal_has_rate_card_project(rate_card_id)`, join к `rate_cards`. Те же
 * четыре сценария, что и для `candidates`, но по второму паттерну проверки
 * — чтобы оба способа из H-6 были покрыты, а не только прямая колонка.
 */
describe("RLS: rates/rate_cards — разграничение по проектам через join (H-6)", () => {
  const marker = testMarker();
  const projectA = `${marker}-A`;
  const projectB = `${marker}-B`;

  let recruiterA: TestPortalUser;
  let head: TestPortalUser;
  let rateCardB: { id: string; project: string };
  let rateInB: { id: string };

  beforeAll(async () => {
    recruiterA = await createTestPortalUser("recruiter", [projectA], marker);
    head = await createTestPortalUser("head", [`${marker}-unused`], marker);

    // rateCardA не используется напрямую в проверках ниже — нужна только
    // как данные проекта A, чтобы тесту "видит только свой проект" было
    // что найти.
    await insertTestRow("rate_cards", { project: projectA, city: "Тест" });
    rateCardB = await insertTestRow("rate_cards", { project: projectB, city: "Тест" });
    rateInB = await insertTestRow("rates", { rate_card_id: rateCardB.id, position: "Тест" });
  });

  afterAll(async () => {
    await cleanupTestFixtures(marker);
  });

  it("роль видит rate_cards только разрешённого проекта", async () => {
    const response = await asUserFetch(
      recruiterA.id,
      `/rate_cards?select=project&project=in.(${projectA},${projectB})`,
    );
    const rows = (await response.json()) as { project: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.project === projectA)).toBe(true);
  });

  it("роль не видит rates чужого rate_card вообще", async () => {
    const response = await asUserFetch(recruiterA.id, `/rates?rate_card_id=eq.${rateInB.id}&select=id`);
    const rows = (await response.json()) as unknown[];
    expect(rows).toHaveLength(0);
  });

  it("роль не может вставить rates под чужой rate_card_id — 403 и код 42501", async () => {
    const response = await asUserFetch(recruiterA.id, "/rates", {
      method: "POST",
      body: JSON.stringify({ rate_card_id: rateCardB.id, position: "Попытка" }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("42501");
  });

  it("head видит rate_cards обоих проектов сразу", async () => {
    const response = await asUserFetch(head.id, `/rate_cards?select=project&project=in.(${projectA},${projectB})`);
    const rows = (await response.json()) as { project: string }[];
    const projects = new Set(rows.map((r) => r.project));
    expect(projects.has(projectA)).toBe(true);
    expect(projects.has(projectB)).toBe(true);
  });
});
