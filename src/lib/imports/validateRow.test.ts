import { describe, expect, it } from "vitest";
import { validateRow, type RawImportRow } from "./validateRow";

const KNOWN_CITIES = ["Москва", "Санкт-Петербург"];
const KNOWN_POSITIONS = ["Курьер", "Кладовщик"];

function makeRaw(overrides: Partial<RawImportRow> = {}): RawImportRow {
  return {
    rowNumber: 2,
    project: "Лавка",
    city: "Москва",
    position: "Курьер",
    date: "2026-08-05",
    demand: "10",
    address: "ул. Ленина, 1",
    ...overrides,
  };
}

describe("validateRow", () => {
  it("accepts a well-formed row and normalizes it", () => {
    const result = validateRow(makeRaw(), KNOWN_CITIES, KNOWN_POSITIONS);
    expect(result).toEqual({
      row: { project: "Лавка", city: "Москва", position: "Курьер", date: "2026-08-05", demand: 10, address: "ул. Ленина, 1" },
    });
  });

  it("accepts ru-RU date format ДД.ММ.ГГГГ", () => {
    const result = validateRow(makeRaw({ date: "05.08.2026" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("row" in result && result.row.date).toBe("2026-08-05");
  });

  it("treats a missing address as null, not an error", () => {
    const result = validateRow(makeRaw({ address: "" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("row" in result && result.row.address).toBeNull();
  });

  it("matches city case-insensitively and trims whitespace", () => {
    const result = validateRow(makeRaw({ city: "  москва  " }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("row" in result && result.row.city).toBe("Москва");
  });

  it("rejects an empty row", () => {
    const result = validateRow(
      makeRaw({ city: "", position: "", date: "", demand: "" }),
      KNOWN_CITIES,
      KNOWN_POSITIONS,
    );
    expect("error" in result && result.error.reason).toBe("Пустая строка");
  });

  it("rejects a missing project", () => {
    const result = validateRow(makeRaw({ project: "" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.reason).toBe("Не указан проект");
  });

  it("rejects an unknown city", () => {
    const result = validateRow(makeRaw({ city: "Нижний Новгород" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.reason).toContain("Неизвестный город");
  });

  it("rejects an unknown position", () => {
    const result = validateRow(makeRaw({ position: "Грузчик" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.reason).toContain("Неизвестная должность");
  });

  it("rejects an unparseable date", () => {
    const result = validateRow(makeRaw({ date: "не дата" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.reason).toContain("Некорректная дата");
  });

  it("rejects a non-numeric demand", () => {
    const result = validateRow(makeRaw({ demand: "много" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.reason).toContain("Некорректная потребность");
  });

  it("rejects a negative demand", () => {
    const result = validateRow(makeRaw({ demand: "-5" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.reason).toBe("Потребность не может быть отрицательной");
  });

  it("accepts a zero demand", () => {
    const result = validateRow(makeRaw({ demand: "0" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("row" in result && result.row.demand).toBe(0);
  });

  it("carries the original row number into the error", () => {
    const result = validateRow(makeRaw({ rowNumber: 42, city: "unknown" }), KNOWN_CITIES, KNOWN_POSITIONS);
    expect("error" in result && result.error.rowNumber).toBe(42);
  });
});
