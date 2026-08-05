import { describe, expect, it } from "vitest";
import { parseInlineTokens, parseRichText } from "./renderFieldValue";

describe("parseInlineTokens", () => {
  it("распознаёт обычный текст без markup", () => {
    expect(parseInlineTokens("просто текст")).toEqual([{ kind: "text", text: "просто текст" }]);
  });

  it("распознаёт жирный текст", () => {
    expect(parseInlineTokens("это **важно** очень")).toEqual([
      { kind: "text", text: "это " },
      { kind: "bold", text: "важно" },
      { kind: "text", text: " очень" },
    ]);
  });

  it("распознаёт курсив", () => {
    expect(parseInlineTokens("*курсив*")).toEqual([{ kind: "italic", text: "курсив" }]);
  });

  it("распознаёт ссылку в формате [текст](url)", () => {
    expect(parseInlineTokens("см. [сюда](https://example.com/doc)")).toEqual([
      { kind: "text", text: "см. " },
      { kind: "link", text: "сюда", url: "https://example.com/doc" },
    ]);
  });

  it("распознаёт голый URL", () => {
    expect(parseInlineTokens("подробнее: https://example.com/vacancy")).toEqual([
      { kind: "text", text: "подробнее: " },
      { kind: "link", text: "https://example.com/vacancy", url: "https://example.com/vacancy" },
    ]);
  });

  it("не распознаёт javascript: как ссылку — просто текст", () => {
    expect(parseInlineTokens("javascript:alert(1)")).toEqual([{ kind: "text", text: "javascript:alert(1)" }]);
  });
});

describe("parseRichText", () => {
  it("пустая строка — пустой массив блоков", () => {
    expect(parseRichText("")).toEqual([]);
  });

  it("один абзац без списка", () => {
    expect(parseRichText("Строка первая\nСтрока вторая")).toEqual([
      { kind: "paragraph", tokens: [{ kind: "text", text: "Строка первая\nСтрока вторая" }] },
    ]);
  });

  it("маркированный список через дефис", () => {
    expect(parseRichText("- Пункт один\n- Пункт два")).toEqual([
      {
        kind: "list",
        items: [
          [{ kind: "text", text: "Пункт один" }],
          [{ kind: "text", text: "Пункт два" }],
        ],
      },
    ]);
  });

  it("абзац, затем список, затем снова абзац — три отдельных блока", () => {
    const blocks = parseRichText("Вступление\n- пункт а\n- пункт б\nЗаключение");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].kind).toBe("paragraph");
    expect(blocks[1].kind).toBe("list");
    expect(blocks[2].kind).toBe("paragraph");
  });

  it("маркер • тоже считается списком", () => {
    const blocks = parseRichText("• один\n• два");
    expect(blocks).toEqual([
      {
        kind: "list",
        items: [
          [{ kind: "text", text: "один" }],
          [{ kind: "text", text: "два" }],
        ],
      },
    ]);
  });
});
