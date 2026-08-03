import { describe, expect, it } from "vitest";
import { isSafeDocumentUrl } from "./addressDocumentLinks";

describe("isSafeDocumentUrl", () => {
  it("разрешает https", () => {
    expect(isSafeDocumentUrl("https://disk.yandex.ru/d/abc123")).toBe(true);
  });

  it("разрешает http", () => {
    expect(isSafeDocumentUrl("http://example.com/doc.pdf")).toBe(true);
  });

  it("отвергает javascript:", () => {
    expect(isSafeDocumentUrl("javascript:fetch('/api/auth/token')")).toBe(false);
  });

  it("отвергает javascript: в другом регистре", () => {
    expect(isSafeDocumentUrl("JavaScript:alert(1)")).toBe(false);
  });

  it("отвергает data:", () => {
    expect(isSafeDocumentUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("отвергает vbscript:", () => {
    expect(isSafeDocumentUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("отвергает пустую и произвольную строку без схемы", () => {
    expect(isSafeDocumentUrl("")).toBe(false);
    expect(isSafeDocumentUrl("не ссылка")).toBe(false);
  });

  it("отвергает протокол-относительный путь без явной схемы", () => {
    expect(isSafeDocumentUrl("//evil.example/path")).toBe(false);
  });
});
