import { describe, expect, it } from "vitest";
import { rlsTestEnv } from "./env";

/**
 * Проверяется первым (алфавитный порядок файлов, "smoke" раньше остальных).
 * Если контейнер не поднялся или переменные не проброшены — тест должен
 * упасть здесь, с понятной причиной, а не дать десятки непонятных ложных
 * падений в сценарных тестах ниже.
 */
describe("smoke: локальный Supabase готов к RLS-тестам", () => {
  it("переменные окружения заданы", () => {
    expect(rlsTestEnv.apiUrl()).toMatch(/^https?:\/\//);
    expect(rlsTestEnv.anonKey().length).toBeGreaterThan(0);
    expect(rlsTestEnv.serviceRoleKey().length).toBeGreaterThan(0);
    expect(rlsTestEnv.jwtSecret().length).toBeGreaterThan(0);
  });

  it("PostgREST отвечает", async () => {
    const response = await fetch(rlsTestEnv.apiUrl());
    // PostgREST на корне отдаёт OpenAPI-описание схемы — важен сам факт
    // ответа (сервис поднят и слушает), а не конкретное содержимое.
    expect(response.status).toBeLessThan(500);
  });

  it("service_role проходит мимо RLS", async () => {
    const key = rlsTestEnv.serviceRoleKey();
    const response = await fetch(`${rlsTestEnv.apiUrl()}/rest/v1/portal_users?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    // portal_users закрыта RLS для authenticated/anon, но не для service_role
    // (RLS вообще не применяется к этой роли на уровне Postgres) — 200
    // здесь означает, что роль настоящая, не подделка.
    expect(response.status).toBe(200);
  });
});
