import { describe, expect, it } from "vitest";
import { describeAction, formatQuantityChange, resolveChangedByLabel } from "./demandHistory";

describe("describeAction", () => {
  it("labels insert/update/delete in Russian", () => {
    expect(describeAction("insert")).toBe("Создано");
    expect(describeAction("update")).toBe("Изменено");
    expect(describeAction("delete")).toBe("Удалено");
  });
});

describe("formatQuantityChange", () => {
  it("renders a fresh insert as — → N", () => {
    expect(formatQuantityChange(null, 5)).toBe("— → 5");
  });

  it("renders an update as old → new", () => {
    expect(formatQuantityChange(5, 8)).toBe("5 → 8");
  });

  it("renders a delete as N → —", () => {
    expect(formatQuantityChange(5, null)).toBe("5 → —");
  });

  it("renders 0 as a real value, not as empty", () => {
    expect(formatQuantityChange(5, 0)).toBe("5 → 0");
    expect(formatQuantityChange(0, 5)).toBe("0 → 5");
  });
});

describe("resolveChangedByLabel", () => {
  it("shows the current user's own email for their own changes", () => {
    expect(resolveChangedByLabel("user-1", "user-1", "me@example.com")).toBe("me@example.com");
  });

  it("falls back to a shortened id for someone else's change", () => {
    expect(resolveChangedByLabel("abcdef1234567890", "user-1", "me@example.com")).toBe("Пользователь abcdef12…");
  });

  it("falls back to a shortened id when there is no known current user (no email to compare against)", () => {
    expect(resolveChangedByLabel("abcdef1234567890", null, null)).toBe("Пользователь abcdef12…");
  });

  it('shows "Неизвестно" when changed_by is null (e.g. a write outside PostgREST)', () => {
    expect(resolveChangedByLabel(null, "user-1", "me@example.com")).toBe("Неизвестно");
  });
});
