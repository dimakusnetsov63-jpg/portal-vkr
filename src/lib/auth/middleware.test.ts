import { describe, expect, it } from "vitest";
import { isTrustedOrigin } from "./middleware";

/**
 * Чистая функция сравнения `Origin`/`Host` (H-15) — тестируется без
 * реального `NextRequest`, как и остальная auth-логика проекта.
 */
describe("isTrustedOrigin", () => {
  it("доверяет origin, чей host совпадает с host запроса", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru", "portal-vkr.ru")).toBe(true);
  });

  it("доверяет localhost при совпадении host", () => {
    expect(isTrustedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("отвергает несовпадающий host — межсайтовый запрос", () => {
    expect(isTrustedOrigin("https://evil.example", "portal-vkr.ru")).toBe(false);
  });

  it("отвергает поддомен, даже похожий на легитимный", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru.evil.example", "portal-vkr.ru")).toBe(false);
  });

  it("отвергает отсутствующий Origin", () => {
    expect(isTrustedOrigin(null, "portal-vkr.ru")).toBe(false);
  });

  it("отвергает отсутствующий Host", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru", null)).toBe(false);
  });

  it("отвергает невалидный Origin (например, 'null' из sandboxed iframe)", () => {
    expect(isTrustedOrigin("null", "portal-vkr.ru")).toBe(false);
  });

  it("порт учитывается как часть host — разные порты не совпадают", () => {
    expect(isTrustedOrigin("https://portal-vkr.ru:8443", "portal-vkr.ru")).toBe(false);
  });
});
