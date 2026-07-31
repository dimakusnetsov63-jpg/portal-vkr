import { describe, expect, it } from "vitest";
import type { RateCardRow, RateRow } from "@/lib/supabase/rates.types";
import { filterRates, type RateFilters } from "./rateFilters";
import type { RateWithCard } from "./rateMetrics";

function makeCard(overrides: Partial<RateCardRow> = {}): RateCardRow {
  return {
    id: "card-1",
    project: "Самокат",
    city: "Москва",
    legal_entity: "Ракета",
    payroll_banks: [],
    bonuses: null,
    promotions: null,
    surcharges: null,
    hiring_conditions: null,
    notes: null,
    manager: null,
    office_status: "unknown",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    created_by: null,
    created_by_login: null,
    updated_by: null,
    updated_by_login: null,
    ...overrides,
  };
}

function makeRate(overrides: Partial<RateRow> = {}): RateRow {
  return {
    id: "rate-1",
    rate_card_id: "card-1",
    position: "вело-курьер",
    unit: "hour",
    rate_hour: 100,
    rate_hour_priority: null,
    rate_piece: null,
    pieces_per_shift: null,
    rate_shift: null,
    shift_hours: 12,
    surcharge_per_shift: null,
    schedule: null,
    extras: [],
    comment: null,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    created_by: null,
    created_by_login: null,
    updated_by: null,
    updated_by_login: null,
    ...overrides,
  };
}

function makeRow(cardOverrides: Partial<RateCardRow> = {}, rateOverrides: Partial<RateRow> = {}): RateWithCard {
  return { card: makeCard(cardOverrides), rate: makeRate(rateOverrides) };
}

const noFilters: RateFilters = {
  search: "",
  project: "",
  city: "",
  legalEntity: "",
  position: "",
  unit: "",
  schedule: "",
};

describe("filterRates", () => {
  it("applies exact-match filters (project/city/legalEntity/position/unit/schedule)", () => {
    const rows = [
      makeRow({ project: "Самокат" }, { id: "1" }),
      makeRow({ project: "Купер" }, { id: "2" }),
    ];
    expect(filterRates(rows, { ...noFilters, project: "Купер" }).map((r) => r.rate.id)).toEqual(["2"]);
  });

  it("matches search against position, project, city, legal entity and comment at once", () => {
    const rows = [
      makeRow({}, { id: "1", position: "вело-курьер" }),
      makeRow({ city: "Казань" }, { id: "2", position: "сборщик" }),
      makeRow({ legal_entity: "Азбука Логистики" }, { id: "3", position: "сборщик" }),
      makeRow({}, { id: "4", position: "сборщик", comment: "особые условия" }),
    ];
    expect(filterRates(rows, { ...noFilters, search: "вело-курьер" }).map((r) => r.rate.id)).toEqual(["1"]);
    expect(filterRates(rows, { ...noFilters, search: "казань" }).map((r) => r.rate.id)).toEqual(["2"]);
    expect(filterRates(rows, { ...noFilters, search: "азбука" }).map((r) => r.rate.id)).toEqual(["3"]);
    expect(filterRates(rows, { ...noFilters, search: "особые" }).map((r) => r.rate.id)).toEqual(["4"]);
  });

  it("search is case-insensitive", () => {
    const rows = [makeRow({}, { id: "1", position: "Вело-Курьер" })];
    expect(filterRates(rows, { ...noFilters, search: "вело-курьер" }).map((r) => r.rate.id)).toEqual(["1"]);
  });

  it("does not mutate the input array", () => {
    const rows = [makeRow({}, { id: "1" })];
    const snapshot = JSON.parse(JSON.stringify(rows));
    filterRates(rows, { ...noFilters, search: "x" });
    expect(rows).toEqual(snapshot);
  });
});
