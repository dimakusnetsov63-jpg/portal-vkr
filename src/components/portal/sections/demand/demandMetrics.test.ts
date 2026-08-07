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

// Курьер в Москве: 100 (24.07) и 200 (25.07) — среднее 150, не сумма 300
// (пример из требования, зафиксированного в docs/requirements/demand.md).
const ROWS: StaffingDemandRow[] = [
  makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-24", planned_count: 100 }),
  makeRow({ project: "Самокат", city: "Москва", position: "Курьер", demand_date: "2026-07-25", planned_count: 200 }),
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
  it("averages dated values for one (project, city, position), not sums them", () => {
    // (100 + 200) / 2 = 150 — не 300.
    expect(positionPeriodTotal(MATRIX["Самокат"]["Москва"]["Курьер"])).toBe(150);
  });

  it("divides only by the days that actually have a value, not the whole visible window", () => {
    // Одна должность с одним заполненным днём — среднее равно этому дню,
    // а не делится на длину всего окна «Потребности».
    expect(positionPeriodTotal({ "2026-07-24": 3 })).toBe(3);
  });

  it("rounds to the nearest whole person", () => {
    expect(positionPeriodTotal({ "2026-07-24": 1, "2026-07-25": 2 })).toBe(2); // 1.5 → 2
  });

  it("returns 0 for an undefined position (no rows)", () => {
    expect(positionPeriodTotal(undefined)).toBe(0);
  });

  it("returns 0 for an empty date map", () => {
    expect(positionPeriodTotal({})).toBe(0);
  });
});

describe("cityPeriodTotal", () => {
  it("sums the average daily need of every position in a city", () => {
    // 150 (среднее Курьера) + 3 (единственный день Кассира — среднее = 3).
    expect(cityPeriodTotal(MATRIX, "Самокат", "Москва")).toBe(153);
  });
  it("returns 0 for a city with no rows", () => {
    expect(cityPeriodTotal(MATRIX, "Самокат", "Уфа")).toBe(0);
  });
});

describe("projectPeriodTotal", () => {
  it("sums cityPeriodTotal across every city of a project", () => {
    expect(projectPeriodTotal(MATRIX, "Самокат")).toBe(155); // 153 (Москва) + 2 (Казань)
  });
  it("returns 0 for a project with no rows", () => {
    expect(projectPeriodTotal(MATRIX, "ДонатсКофе")).toBe(0);
  });
});

describe("grandTotalsByColumn", () => {
  it("sums every visible (project, city, position) for each column — one date, nothing to average", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-25");
    const totals = grandTotalsByColumn(MATRIX, VISIBLE, columns);
    // 2026-07-24: 100 (Самокат/Москва/Курьер) + 3 (Самокат/Москва/Кассир) + 2 (Самокат/Казань/Курьер) + 9 (Купер/Москва/Курьер) = 114
    // 2026-07-25: 200 (Самокат/Москва/Курьер) + 0 + 0 + 0 = 200
    expect(totals).toEqual([114, 200]);
  });

  it("returns all zeros when there is nothing visible", () => {
    const columns = getDayColumns("2026-07-24", "2026-07-25");
    expect(grandTotalsByColumn(MATRIX, [], columns)).toEqual([0, 0]);
  });
});

describe("grandPeriodTotal", () => {
  it("sums the average daily need of every visible row, not the raw totals", () => {
    expect(grandPeriodTotal(MATRIX, VISIBLE)).toBe(164); // 150 + 3 + 2 + 9
  });

  it("returns 0 when there is nothing visible", () => {
    expect(grandPeriodTotal(MATRIX, [])).toBe(0);
  });
});
