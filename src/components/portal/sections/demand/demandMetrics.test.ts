import { describe, expect, it } from "vitest";
import { buildDemandMatrix, getDayColumns } from "./demandAggregate";
import { cityPeriodTotal, grandPeriodTotal, grandTotalsByColumn, projectPeriodTotal } from "./demandMetrics";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";

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

const ROWS: StaffingDemandRow[] = [
  makeRow({ project: "Самокат", city: "Москва", demand_date: "2026-07-24", planned_count: 5 }),
  makeRow({ project: "Самокат", city: "Москва", demand_date: "2026-07-25", planned_count: 7 }),
  makeRow({ project: "Самокат", city: "Казань", demand_date: "2026-07-24", planned_count: 2 }),
  makeRow({ project: "Купер", city: "Москва", demand_date: "2026-07-24", planned_count: 9 }),
];
const MATRIX = buildDemandMatrix(ROWS);
const VISIBLE = [
  { project: "Самокат", city: "Москва" },
  { project: "Самокат", city: "Казань" },
  { project: "Купер", city: "Москва" },
];

describe("cityPeriodTotal", () => {
  it("sums every dated value for a city", () => {
    expect(cityPeriodTotal(MATRIX["Самокат"]["Москва"])).toBe(12);
  });
  it("returns 0 for an undefined city (no rows)", () => {
    expect(cityPeriodTotal(undefined)).toBe(0);
  });
  it("returns 0 for an empty date map", () => {
    expect(cityPeriodTotal({})).toBe(0);
  });
});

describe("projectPeriodTotal", () => {
  it("sums cityPeriodTotal across every city of a project", () => {
    expect(projectPeriodTotal(MATRIX, "Самокат")).toBe(14); // 12 (Москва) + 2 (Казань)
  });
  it("returns 0 for a project with no rows", () => {
    expect(projectPeriodTotal(MATRIX, "ДонатсКофе")).toBe(0);
  });
});

describe("grandTotalsByColumn", () => {
  it("sums every visible project/city for each column", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-25");
    const totals = grandTotalsByColumn(MATRIX, VISIBLE, columns);
    // 2026-07-24: 5 (Самокат/Москва) + 2 (Самокат/Казань) + 9 (Купер/Москва) = 16
    // 2026-07-25: 7 (Самокат/Москва) + 0 + 0 = 7
    expect(totals).toEqual([16, 7]);
  });

  it("returns all zeros when there is nothing visible", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-25");
    expect(grandTotalsByColumn(MATRIX, [], columns)).toEqual([0, 0]);
  });
});

describe("grandPeriodTotal", () => {
  it("sums every visible project/city across the whole period", () => {
    expect(grandPeriodTotal(MATRIX, VISIBLE)).toBe(23); // 12 + 2 + 9
  });

  it("returns 0 when there is nothing visible", () => {
    expect(grandPeriodTotal(MATRIX, [])).toBe(0);
  });
});
