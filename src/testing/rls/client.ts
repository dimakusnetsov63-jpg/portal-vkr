import type { PortalRole } from "@/lib/auth/roles";
import { rlsTestEnv } from "./env";
import { signTestUserJwt } from "./jwt";

/**
 * Фикстуры и запросы для RLS-тестов (H-13) против эфемерного локального
 * Supabase. `service_role` используется **только** здесь, для подготовки и
 * очистки данных в обход RLS — ни один тест не проверяет поведение под
 * `service_role`, только под `portal_can`/`portal_has_project` реальных
 * ролей портала.
 *
 * Изоляция тестов: каждый набор фикстур помечается уникальным `marker`
 * (используется как часть `login`/`project`/`comment`) и удаляется в
 * `afterAll`/`afterEach` вызывающего теста — не полагаемся только на то,
 * что база эфемерная и будет уничтожена целиком, чтобы тесты оставались
 * независимыми и в будущем, если харнесс сменится на переиспользуемую базу.
 */

function restUrl(path: string): string {
  return `${rlsTestEnv.apiUrl()}/rest/v1${path}`;
}

/**
 * Запрос в обход RLS. Экспортируется для тестов, где ожидаемым результатом
 * является **ошибка** (нарушение CHECK-ограничения) — `insertTestRow` для
 * них не годится, он бросает на любом не-2xx и съедает проверяемый ответ.
 */
export async function serviceRoleFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = rlsTestEnv.serviceRoleKey();
  return fetch(restUrl(path), {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
}

/** Запрос от имени конкретного тестового пользователя портала — ровно то, что видит PostgREST от реального клиента. */
export async function asUserFetch(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const token = signTestUserJwt(userId);
  return fetch(restUrl(path), {
    ...init,
    headers: {
      apikey: rlsTestEnv.anonKey(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
}

/** Уникальный маркер на прогон теста — часть логина, названий проектов и т.п., чтобы фикстуры разных тестов не пересекались. */
export function testMarker(): string {
  return `rlstest${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestPortalUser {
  id: string;
  role: PortalRole;
  projects: string[];
}

/** Заводит тестового пользователя напрямую в portal_users, в обход бизнес-правил portal_admin_create_user — это фикстура, не то, что проверяет тест. */
export async function createTestPortalUser(
  role: PortalRole,
  projects: string[],
  marker: string,
): Promise<TestPortalUser> {
  const login = `${marker}${role}`.toLowerCase().slice(0, 32);
  const response = await serviceRoleFetch("/portal_users", {
    method: "POST",
    body: JSON.stringify({
      full_name: `RLS Test ${role}`,
      login,
      // Не настоящий bcrypt-хеш — фикстура никогда не проходит portal_login,
      // JWT для неё подписывается напрямую (signTestUserJwt). NOT NULL —
      // единственное ограничение колонки, формат не проверяется.
      password_hash: "rls-test-fixture-not-a-real-hash",
      role,
      projects,
      is_active: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Не удалось создать тестового пользователя (${role}): ${response.status} ${await response.text()}`);
  }
  const [user] = (await response.json()) as TestPortalUser[];
  return user;
}

/** Вставляет произвольную строку в обход RLS — фикстура тестовых данных (кандидат, тариф и т.п.), не то, что проверяет тест. */
export async function insertTestRow<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const response = await serviceRoleFetch(`/${table}`, { method: "POST", body: JSON.stringify(row) });
  if (!response.ok) {
    throw new Error(`Не удалось создать фикстуру в ${table}: ${response.status} ${await response.text()}`);
  }
  const [created] = (await response.json()) as T[];
  return created;
}

/**
 * Читает строку в обход RLS — нужна, чтобы проверить, что запись
 * действительно **не изменилась** после отклонённой попытки записи. Без
 * этого тест «UPDATE чужой строки не сработал» опирался бы только на код
 * ответа, а `USING`-отказ в PostgREST выглядит как обычный успех с нулём
 * затронутых строк (см. `candidates.rls-test.ts`).
 */
export async function readRowAsServiceRole<T>(table: string, id: string): Promise<T | undefined> {
  const response = await serviceRoleFetch(`/${table}?id=eq.${id}`);
  if (!response.ok) {
    throw new Error(`Не удалось прочитать ${table}/${id}: ${response.status} ${await response.text()}`);
  }
  const [row] = (await response.json()) as T[];
  return row;
}

/**
 * Удаляет все тестовые фикстуры с этим маркером — вызывать в `afterAll`
 * каждого RLS-теста. `rate_cards` удаляется последним и каскадом уносит
 * свои `rates` (`on delete cascade`, см. `schema.md`) — отдельно чистить
 * `rates` не нужно. `addresses` тем же способом каскадом уносит свои
 * `address_demand_history` (`on delete cascade`) — явное удаление истории
 * ниже избыточно, но оставлено, чтобы порядок не зависел от того, помнит
 * ли следующий читающий про этот cascade (тот же приём, что и с
 * `rate_cards`/`rates`).
 */
export async function cleanupTestFixtures(marker: string): Promise<void> {
  await serviceRoleFetch(`/portal_users?login=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/candidates?project=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/rate_cards?project=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/address_demand_history?project=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/addresses?project=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/staffing_demand?project=like.${marker}*`, { method: "DELETE" });
  await serviceRoleFetch(`/staffing_demand_imports?project=like.${marker}*`, { method: "DELETE" });
}
