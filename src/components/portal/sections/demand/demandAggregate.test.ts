import { describe, expect, it } from "vitest";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";
import {
  buildBulkRows,
  buildDemandMatrix,
  DEMAND_BULK_CONFIRM_THRESHOLD,
  demandCityGroupKey,
  demandLevelForValue,
  filterGroupsByCellPredicate,
  getDayColumns,
  isLargeBulkCount,
  isValidPlannedCount,
  listVisibleRows,
  type DemandGroupedProject,
} from "./demandAggregate";

function makeRow(overrides: Partial<StaffingDemandRow> = {}): StaffingDemandRow {
  return {
    id: "id-1",
    project: "Самокат",
    city: "Москва",
    position: "Курьер",
    demand_date: "2026-07-24",
    planned_count: 5,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    address: null,
    source: "manual",
    import_id: null,
    ...overrides,
  };
}

describe("buildDemandMatrix", () => {
  it("groups rows by project, then city, then position, then date", () => {
    const rows = [
      makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 5 }),
      makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-25", planned_count: 7 }),
      makeRow({ project: "Самокат", city: "Москва", position: "Кассир", demand_date: "2026-07-24", planned_count: 3 }),
      makeRow({ project: "Самокат", city: "Казань", position: "Курьер", demand_date: "2026-07-24", planned_count: 2 }),
      makeRow({ project: "Купер", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 9 }),
    ];
    const matrix = buildDemandMatrix(rows);
    expect(matrix["Самокат"]["Москва"]["Курьер"]).toEqual({ "2026-07-24": 5, "2026-07-25": 7 });
    expect(matrix["Самокат"]["Москва"]["Кассир"]).toEqual({ "2026-07-24": 3 });
    expect(matrix["Самокат"]["Казань"]["Курьер"]).toEqual({ "2026-07-24": 2 });
    expect(matrix["Купер"]["Москва"]["Курьер"]).toEqual({ "2026-07-24": 9 });
  });

  it("returns an empty object for an empty input", () => {
    expect(buildDemandMatrix([])).toEqual({});
  });
});

describe("listVisibleRows", () => {
  it("returns distinct (project, city, position) triples, sorted", () => {
    const rows = [
      makeRow({ project: "Купер", city: "Казань", position: "Курьер" }),
      makeRow({ project: "Самокат", city: "Москва", position: "Кассир" }),
      makeRow({ project: "Купер", city: "Казань", position: "Курьер", demand_date: "2026-07-25" }),
      makeRow({ project: "Самокат", city: "Казань", position: "Курьер" }),
    ];
    expect(listVisibleRows(rows)).toEqual([
      { project: "Купер", city: "Казань", position: "Курьер" },
      { project: "Самокат", city: "Казань", position: "Курьер" },
      { project: "Самокат", city: "Москва", position: "Кассир" },
    ]);
  });

  it("treats the same (project, city) with a different position as a distinct visible row", () => {
    const rows = [
      makeRow({ project: "Самокат", city: "Москва", position: "Курьер" }),
      makeRow({ project: "Самокат", city: "Москва", position: "Кассир" }),
    ];
    expect(listVisibleRows(rows)).toHaveLength(2);
  });

  it("does not include project/city/position triples with no rows (no full cross-product)", () => {
    const rows = [makeRow({ project: "Самокат", city: "Москва", position: "Курьер" })];
    const visible = listVisibleRows(rows);
    expect(visible).toHaveLength(1);
    expect(visible.some((v) => v.project === "Купер")).toBe(false);
  });
});

describe("demandCityGroupKey", () => {
  it("produces different keys for different (project, city) pairs", () => {
    expect(demandCityGroupKey("Самокат", "Москва")).not.toBe(demandCityGroupKey("Купер", "Москва"));
  });
  it("does not collide when a delimiter-joined string would (boundary shifts between fields)", () => {
    expect(demandCityGroupKey("AB", "C")).not.toBe(demandCityGroupKey("A", "BC"));
  });
  it("is stable for the same inputs", () => {
    expect(demandCityGroupKey("Самокат", "Москва")).toBe(demandCityGroupKey("Самокат", "Москва"));
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

describe("isLargeBulkCount", () => {
  it("is false at and below the threshold", () => {
    expect(isLargeBulkCount(DEMAND_BULK_CONFIRM_THRESHOLD)).toBe(false);
    expect(isLargeBulkCount(1)).toBe(false);
  });
  it("is true above the threshold", () => {
    expect(isLargeBulkCount(DEMAND_BULK_CONFIRM_THRESHOLD + 1)).toBe(true);
  });
});

describe("buildBulkRows", () => {
  it("builds one row per (city × position × date) with the same planned_count", () => {
    const rows = buildBulkRows({
      project: "Самокат",
      cities: ["Москва", "Казань"],
      positions: ["Курьер", "Кассир"],
      fromDate: "2026-07-24",
      toDate: "2026-07-24",
      plannedCount: 5,
    });
    expect(rows).toEqual([
      { project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 5 },
      { project: "Самокат", city: "Москва", position: "Кассир", demand_date: "2026-07-24", planned_count: 5 },
      { project: "Самокат", city: "Казань", position: "Курьер", demand_date: "2026-07-24", planned_count: 5 },
      { project: "Самокат", city: "Казань", position: "Кассир", demand_date: "2026-07-24", planned_count: 5 },
    ]);
  });

  it("returns an empty array when no cities are selected", () => {
    expect(
      buildBulkRows({
        project: "Самокат",
        cities: [],
        positions: ["Курьер"],
        fromDate: "2026-07-24",
        toDate: "2026-07-25",
        plannedCount: 5,
      }),
    ).toEqual([]);
  });

  it("returns an empty array when no positions are selected", () => {
    expect(
      buildBulkRows({
        project: "Самокат",
        cities: ["Москва"],
        positions: [],
        fromDate: "2026-07-24",
        toDate: "2026-07-25",
        plannedCount: 5,
      }),
    ).toEqual([]);
  });
});

describe("filterGroupsByCellPredicate", () => {
  const matrix = buildDemandMatrix([
    makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 5 }),
    makeRow({ project: "Самокат", city: "Казань", position: "Курьер", demand_date: "2026-07-24", planned_count: 0 }),
    makeRow({ project: "Купер", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 0 }),
  ]);
  const grouped: DemandGroupedProject[] = [
    { project: "Самокат", cities: [{ city: "Москва", positions: ["Курьер"] }, { city: "Казань", positions: ["Курьер"] }] },
    { project: "Купер", cities: [{ city: "Москва", positions: ["Курьер"] }] },
  ];

  it("keeps a row as soon as one of its cells satisfies the predicate", () => {
    const result = filterGroupsByCellPredicate(grouped, matrix, (v) => v > 0);
    expect(result).toEqual([{ project: "Самокат", cities: [{ city: "Москва", positions: ["Курьер"] }] }]);
  });

  it("drops a whole project group when none of its cities/positions qualify", () => {
    const result = filterGroupsByCellPredicate(grouped, matrix, (v) => v > 0);
    expect(result.some((g) => g.project === "Купер")).toBe(false);
  });

  it("does not require every date to qualify, only at least one", () => {
    const twoDateMatrix = buildDemandMatrix([
      makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 0 }),
      makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-25", planned_count: 3 }),
    ]);
    const result = filterGroupsByCellPredicate(
      [{ project: "Самокат", cities: [{ city: "Москва", positions: ["Курьер"] }] }],
      twoDateMatrix,
      (v) => v > 0,
    );
    expect(result).toEqual([{ project: "Самокат", cities: [{ city: "Москва", positions: ["Курьер"] }] }]);
  });

  it("keeps only the qualifying position within a city, dropping the rest", () => {
    const twoPositionMatrix = buildDemandMatrix([
      makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 5 }),
      makeRow({ project: "Самокат", city: "Москва", position: "Кассир", demand_date: "2026-07-24", planned_count: 0 }),
    ]);
    const result = filterGroupsByCellPredicate(
      [{ project: "Самокат", cities: [{ city: "Москва", positions: ["Курьер", "Кассир"] }] }],
      twoPositionMatrix,
      (v) => v > 0,
    );
    expect(result).toEqual([{ project: "Самокат", cities: [{ city: "Москва", positions: ["Курьер"] }] }]);
  });
});
