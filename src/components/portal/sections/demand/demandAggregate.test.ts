import { describe, expect, it } from "vitest";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";
import {
  buildDemandMatrix,
  demandLevelForValue,
  getDayColumns,
  isValidPlannedCount,
  listVisibleProjectCities,
} from "./demandAggregate";

function makeRow(overrides: Partial<StaffingDemandRow> = {}): StaffingDemandRow {
  return {
    id: "id-1",
    project: "Самокат",
    city: "Москва",
    demand_date: "2026-07-24",
    planned_count: 5,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDemandMatrix", () => {
  it("groups rows by project, then city, then date", () => {
    const rows = [
      makeRow({ project: "Самокат", city: "Москва", demand_date: "2026-07-24", planned_count: 5 }),
      makeRow({ project: "Самокат", city: "Москва", demand_date: "2026-07-25", planned_count: 7 }),
      makeRow({ project: "Самокат", city: "Казань", demand_date: "2026-07-24", planned_count: 2 }),
      makeRow({ project: "Купер", city: "Москва", demand_date: "2026-07-24", planned_count: 9 }),
    ];
    const matrix = buildDemandMatrix(rows);
    expect(matrix["Самокат"]["Москва"]).toEqual({ "2026-07-24": 5, "2026-07-25": 7 });
    expect(matrix["Самокат"]["Казань"]).toEqual({ "2026-07-24": 2 });
    expect(matrix["Купер"]["Москва"]).toEqual({ "2026-07-24": 9 });
  });

  it("returns an empty object for an empty input", () => {
    expect(buildDemandMatrix([])).toEqual({});
  });
});

describe("listVisibleProjectCities", () => {
  it("returns distinct (project, city) pairs, sorted", () => {
    const rows = [
      makeRow({ project: "Купер", city: "Казань" }),
      makeRow({ project: "Самокат", city: "Москва" }),
      makeRow({ project: "Купер", city: "Казань", demand_date: "2026-07-25" }),
      makeRow({ project: "Самокат", city: "Казань" }),
    ];
    expect(listVisibleProjectCities(rows)).toEqual([
      { project: "Купер", city: "Казань" },
      { project: "Самокат", city: "Казань" },
      { project: "Самокат", city: "Москва" },
    ]);
  });

  it("does not include project/city pairs with no rows (no full cross-product)", () => {
    const rows = [makeRow({ project: "Самокат", city: "Москва" })];
    const visible = listVisibleProjectCities(rows);
    expect(visible).toHaveLength(1);
    expect(visible.some((v) => v.project === "Купер")).toBe(false);
  });
});

describe("getDayColumns", () => {
  it("returns one column per day, inclusive of both endpoints", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-26");
    expect(columns.map((c) => c.key)).toEqual(["2026-07-24", "2026-07-25", "2026-07-26"]);
  });

  it("marks Saturday/Sunday columns as weekend", () => {
    // 2026-07-25 is a Saturday, 2026-07-26 a Sunday.
    const columns = getDayColumns("2026-07-24", "2026-07-26");
    expect(columns.find((c) => c.key === "2026-07-24")?.weekend).toBe(false);
    expect(columns.find((c) => c.key === "2026-07-25")?.weekend).toBe(true);
    expect(columns.find((c) => c.key === "2026-07-26")?.weekend).toBe(true);
  });

  it("returns a single column when from equals to", () => {
    expect(getDayColumns("2026-07-24", "2026-07-24")).toHaveLength(1);
  });
});

describe("demandLevelForValue", () => {
  it("classifies null as empty (not set)", () => {
    expect(demandLevelForValue(null)).toBe("empty");
  });
  it("classifies 0 as zero", () => {
    expect(demandLevelForValue(0)).toBe("zero");
  });
  it("classifies 1-4 as normal", () => {
    expect(demandLevelForValue(1)).toBe("normal");
    expect(demandLevelForValue(4)).toBe("normal");
  });
  it("classifies 5-9 as elevated", () => {
    expect(demandLevelForValue(5)).toBe("elevated");
    expect(demandLevelForValue(9)).toBe("elevated");
  });
  it("classifies 10+ as critical", () => {
    expect(demandLevelForValue(10)).toBe("critical");
    expect(demandLevelForValue(25)).toBe("critical");
  });
});

describe("isValidPlannedCount", () => {
  it("accepts non-negative integers", () => {
    expect(isValidPlannedCount(0)).toBe(true);
    expect(isValidPlannedCount(7)).toBe(true);
  });
  it("rejects negative values", () => {
    expect(isValidPlannedCount(-1)).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(isValidPlannedCount(1.5)).toBe(false);
  });
  it("rejects NaN", () => {
    expect(isValidPlannedCount(Number.NaN)).toBe(false);
  });
});
