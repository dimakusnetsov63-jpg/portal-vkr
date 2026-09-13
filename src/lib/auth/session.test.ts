import { describe, expect, it } from "vitest";
import { decodeSessionHeader, encodeSessionHeader, type PortalSession } from "./session";

/**
 * Передача уже проверенной сессии из middleware в Server Components
 * (`SESSION_HEADER`). Тестируется чистая пара кодирования — то же, что и с
 * остальной auth-логикой проекта: без реального `NextRequest`.
 *
 * Чего эти тесты НЕ проверяют: что `guardRequest` действительно вычищает
 * пришедший снаружи заголовок. Это свойство самого конвейера Next, а не
 * чистой функции, и держится на `stripForgedSessionHeader` первым действием
 * в `middleware.ts` — проверять его нужно живым запросом, а не здесь.
 */
function makeSession(): PortalSession {
  return {
    sessionId: "session-id",
    user: {
      id: "user-id",
      full_name: "Тест Тестов",
      login: "hr39@outsourcing-kadrov.ru",
      role: "head",
      projects: ["Самокат"],
      all_projects: false,
      is_active: true,
      created_at: "2026-09-13T00:00:00Z",
      updated_at: "2026-09-13T00:00:00Z",
      last_login_at: null,
      permissions: { candidates: { visible: true, can_view: true, can_edit: true } },
    },
  };
}

describe("SESSION_HEADER", () => {
  it("переживает круг кодирования без потерь", () => {
    const session = makeSession();
    expect(decodeSessionHeader(encodeSessionHeader(session))).toEqual(session);
  });

  it("не ломается на кириллице: значения заголовков latin1, а full_name — нет", () => {
    const session = makeSession();
    const encoded = encodeSessionHeader(session);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decodeSessionHeader(encoded)?.user.full_name).toBe("Тест Тестов");
  });

  it("отдаёт null на отсутствующем значении — вызывающий спросит базу", () => {
    expect(decodeSessionHeader(null)).toBeNull();
    expect(decodeSessionHeader(undefined)).toBeNull();
    expect(decodeSessionHeader("")).toBeNull();
  });

  it("отдаёт null на мусоре, а не бросает", () => {
    expect(decodeSessionHeader("не base64")).toBeNull();
    expect(decodeSessionHeader(btoa("{ not json"))).toBeNull();
  });

  it("отдаёт null на валидном JSON не той формы", () => {
    // Запасной путь через базу лучше, чем сессия без пользователя дальше по коду.
    expect(decodeSessionHeader(btoa(JSON.stringify({ sessionId: "x" })))).toBeNull();
    expect(decodeSessionHeader(btoa(JSON.stringify({ user: {} })))).toBeNull();
  });
});
