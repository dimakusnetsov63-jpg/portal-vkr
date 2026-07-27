import { describe, expect, it } from "vitest";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";
import { filterDemandRows, type DemandFilters } from "./demandFilters";

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
    ...overrides,
  };
}

const NO_FILTERS: DemandFilters = { search: "", project: "", city: "", position: "" };

describe("filterDemandRows", () => {
  it("returns all rows when no filters are set", () => {
    const rows = [makeRow({ id: "1" }), makeRow({ id: "2" })];
    expect(filterDemandRows(rows, NO_FILTERS).map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("filters by exact project (empty means all)", () => {
    const rows = [
      makeRow({ id: "1", project: "Самокат" }),
      makeRow({ id: "2", project: "Купер" }),
    ];
    expect(filterDemandRows(rows, { ...NO_FILTERS, project: "Купер" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterDemandRows(rows, NO_FILTERS)).toHaveLength(2);
  });

  it("filters by exact city (empty means all)", () => {
    const rows = [
      makeRow({ id: "1", city: "Москва" }),
      makeRow({ id: "2", city: "Казань" }),
    ];
    expect(filterDemandRows(rows, { ...NO_FILTERS, city: "Казань" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("filters by exact position (empty means all)", () => {
    const rows = [
      makeRow({ id: "1", position: "Курьер" }),
      makeRow({ id: "2", position: "Кассир" }),
    ];
    expect(filterDemandRows(rows, { ...NO_FILTERS, position: "Кассир" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("searches by project, city or position (case-insensitive, partial)", () => {
    const rows = [
      makeRow({ id: "1", project: "Самокат", city: "Москва", position: "Курьер" }),
      makeRow({ id: "2", project: "Купер", city: "Казань", position: "Кассир" }),
    ];
    expect(filterDemandRows(rows, { ...NO_FILTERS, search: "куп" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterDemandRows(rows, { ...NO_FILTERS, search: "казан" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterDemandRows(rows, { ...NO_FILTERS, search: "касс" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("combines project, city, position and search filters", () => {
    const rows = [
      makeRow({ id: "1", project: "Самокат", city: "Москва", position: "Курьер" }),
      makeRow({ id: "2", project: "Самокат", city: "Казань", position: "Курьер" }),
      makeRow({ id: "3", project: "Купер", city: "Москва", position: "Кассир" }),
    ];
    expect(
      filterDemandRows(rows, { search: "", project: "Самокат", city: "Москва", position: "Курьер" }).map((r) => r.id),
    ).toEqual(["1"]);
  });

  it("returns an empty array when nothing matches", () => {
    const rows = [makeRow({ id: "1" })];
    expect(filterDemandRows(rows, { ...NO_FILTERS, search: "несуществующее" })).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const rows = [makeRow({ id: "1", project: "Самокат" }), makeRow({ id: "2", project: "Купер" })];
    const snapshot = [...rows];
    filterDemandRows(rows, { ...NO_FILTERS, project: "Купер" });
    expect(rows).toEqual(snapshot);
  });
});
