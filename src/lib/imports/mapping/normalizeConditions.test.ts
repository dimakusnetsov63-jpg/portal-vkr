import { describe, expect, it } from "vitest";
import { isYes, normalizeMetro, normalizeScheduleType, normalizeShiftType } from "./normalizeConditions";

describe("normalizeScheduleType", () => {
  it("accepts the canonical form", () => {
    expect(normalizeScheduleType("5/2")).toBe("5/2");
    expect(normalizeScheduleType("2/2")).toBe("2/2");
  });

  // Все варианты ниже реально встречаются в выгрузке «Лавки» (29 написаний одного и того же).
  it.each([
    ["5\\2", "5/2"],
    ["5-2", "5/2"],
    ["5|2", "5/2"],
    ["2\\2", "2/2"],
    [" 6/1 ", "6/1"],
  ])("unifies separators: %s → %s", (raw, expected) => {
    expect(normalizeScheduleType(raw)).toBe(expected);
  });

  it("takes the first recognised schedule when the cell lists several", () => {
    expect(normalizeScheduleType("2/2,5/2")).toBe("2/2");
    expect(normalizeScheduleType("5/2, 6/1")).toBe("5/2");
    expect(normalizeScheduleType("6\\1 3\\1  2\\2")).toBe("6/1");
  });

  it("skips unrecognised leading tokens and finds a valid one further along", () => {
    expect(normalizeScheduleType("3\\1 2\\2")).toBe("2/2");
    expect(normalizeScheduleType("вахта, 5/2")).toBe("5/2");
  });

  it("returns null rather than inventing a value", () => {
    expect(normalizeScheduleType("3/1")).toBeNull();
    expect(normalizeScheduleType("вахта, ежедневно")).toBeNull();
    expect(normalizeScheduleType("")).toBeNull();
  });
});

describe("normalizeShiftType", () => {
  it("maps the Да/Нет flag onto the schema's shift types", () => {
    expect(normalizeShiftType("Да")).toBe("night");
    expect(normalizeShiftType("Нет")).toBe("day");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeShiftType(" да ")).toBe("night");
    expect(normalizeShiftType("НЕТ")).toBe("day");
  });

  it("treats an empty cell as not set", () => {
    expect(normalizeShiftType("")).toBeNull();
    expect(normalizeShiftType("   ")).toBeNull();
  });
});

describe("normalizeMetro", () => {
  it("keeps the value, trimming and collapsing whitespace", () => {
    expect(normalizeMetro("  Владыкино ")).toBe("Владыкино");
    expect(normalizeMetro("Фили\\Шелепиха")).toBe("Фили\\Шелепиха");
    expect(normalizeMetro("некрасовка,  мцд Люберцы")).toBe("некрасовка, мцд Люберцы");
  });

  it("returns null for an empty cell", () => {
    expect(normalizeMetro("")).toBeNull();
    expect(normalizeMetro("   ")).toBeNull();
  });
});

describe("isYes", () => {
  it("recognises the Да flag regardless of case and padding", () => {
    expect(isYes("Да")).toBe(true);
    expect(isYes(" да ")).toBe(true);
  });

  it("treats anything else as no", () => {
    expect(isYes("Нет")).toBe(false);
    expect(isYes("")).toBe(false);
  });
});
