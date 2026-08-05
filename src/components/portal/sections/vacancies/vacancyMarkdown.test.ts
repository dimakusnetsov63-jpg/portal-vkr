import { describe, expect, it } from "vitest";
import { insertLink, toggleBulletLines, wrapSelection } from "./vacancyMarkdown";

describe("wrapSelection", () => {
  it("оборачивает выделенный текст симметричным markup", () => {
    const result = wrapSelection("это важно текст", 4, 9, "**");
    expect(result.value).toBe("это **важно** текст");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("важно");
  });

  it("вставляет пустой markup, если ничего не выделено", () => {
    const result = wrapSelection("текст", 5, 5, "*");
    expect(result.value).toBe("текст**");
    expect(result.selectionStart).toBe(result.selectionEnd);
  });
});

describe("toggleBulletLines", () => {
  it("добавляет маркер к выделенным строкам", () => {
    const value = "пункт один\nпункт два";
    const result = toggleBulletLines(value, 0, value.length);
    expect(result.value).toBe("- пункт один\n- пункт два");
  });

  it("снимает маркер, если все выделенные строки уже с маркером", () => {
    const value = "- пункт один\n- пункт два";
    const result = toggleBulletLines(value, 0, value.length);
    expect(result.value).toBe("пункт один\nпункт два");
  });

  it("работает на одной строке из середины многострочного текста", () => {
    const value = "заголовок\nсредняя строка\nконец";
    const lineStart = value.indexOf("средняя");
    const lineEnd = lineStart + "средняя строка".length;
    const result = toggleBulletLines(value, lineStart, lineEnd);
    expect(result.value).toBe("заголовок\n- средняя строка\nконец");
  });
});

describe("insertLink", () => {
  it("оборачивает выделенный текст в markdown-ссылку", () => {
    const result = insertLink("см. подробности здесь", 4, 22, "https://example.com");
    expect(result.value).toBe("см. [подробности здесь](https://example.com)");
  });

  it("вставляет плейсхолдер, если ничего не выделено", () => {
    const result = insertLink("", 0, 0, "https://example.com");
    expect(result.value).toBe("[текст ссылки](https://example.com)");
  });
});
