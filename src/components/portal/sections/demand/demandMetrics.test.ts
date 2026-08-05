import { describe, expect, it } from "vitest";
import { buildDemandMatrix, getDayColumns } from "./demandAggregate";
import { cityPeriodTotal, grandPeriodTotal, grandTotalsByColumn, positionPeriodTotal, projectPeriodTotal } from "./demandMetrics";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";

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

const ROWS: StaffingDemandRow[] = [
  makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 5 }),
  makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-25", planned_count: 7 }),
  makeRow({ project: "Самокат", city: "Москва", position: "Кассир", demand_date: "2026-07-24", planned_count: 3 }),
  makeRow({ project: "Самокат", city: "Казань", position: "Курьер", demand_date: "2026-07-24", planned_count: 2 }),
  makeRow({ project: "Купер", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 9 }),
];
const MATRIX = buildDemandMatrix(ROWS);
const VISIBLE = [
  { project: "Самокат", city: "Москва", position: "Курьер" },
  { project: "Самокат", city: "Москва", position: "Кассир" },
  { project: "Самокат", city: "Казань", position: "Курьер" },
  { project: "Купер", city: "Москва", position: "Курьер" },
];

describe("positionPeriodTotal", () => {
  it("sums every dated value for one (project, city, position)", () => {
    expect(positionPeriodTotal(MATRIX["Самокат"]["Москва"]["Курьер"])).toBe(12);
  });
  it("returns 0 for an undefined position (no rows)", () => {
    expect(positionPeriodTotal(undefined)).toBe(0);
  });
  it("returns 0 for an empty date map", () => {
    expect(positionPeriodTotal({})).toBe(0);
  });
});

describe("cityPeriodTotal", () => {
  it("sums positionPeriodTotal across every position of a city", () => {
    expect(cityPeriodTotal(MATRIX, "Самокат", "Москва")).toBe(15); // 12 (Курьер) + 3 (Кассир)
  });
  it("returns 0 for a city with no rows", () => {
    expect(cityPeriodTotal(MATRIX, "Самокат", "Уфа")).toBe(0);
  });
});

describe("projectPeriodTotal", () => {
  it("sums cityPeriodTotal across every city of a project", () => {
    expect(projectPeriodTotal(MATRIX, "Самокат")).toBe(17); // 15 (Москва) + 2 (Казань)
  });
  it("returns 0 for a project with no rows", () => {
    expect(projectPeriodTotal(MATRIX, "ДонатсКофе")).toBe(0);
  });
});

describe("grandTotalsByColumn", () => {
  it("sums every visible (project, city, position) for each column", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-25");
    const totals = grandTotalsByColumn(MATRIX, VISIBLE, columns);
    // 2026-07-24: 5 (Самокат/Москва/Курьер) + 3 (Самокат/Москва/Кассир) + 2 (Самокат/Казань/Курьер) + 9 (Купер/Москва/Курьер) = 19
    // 2026-07-25: 7 (Самокат/Москва/Курьер) + 0 + 0 + 0 = 7
    expect(totals).toEqual([19, 7]);
  });

  it("returns all zeros when there is nothing visible", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-25");
    expect(grandTotalsByColumn(MATRIX, [], columns)).toEqual([0, 0]);
  });
});

describe("grandPeriodTotal", () => {
  it("sums every visible (project, city, position) across the whole period", () => {
    expect(grandPeriodTotal(MATRIX, VISIBLE)).toBe(26); // 12 + 3 + 2 + 9
  });

  it("returns 0 when there is nothing visible", () => {
    expect(grandPeriodTotal(MATRIX, [])).toBe(0);
  });
});
