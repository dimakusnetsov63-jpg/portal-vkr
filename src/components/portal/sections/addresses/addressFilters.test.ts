import { describe, expect, it } from "vitest";
import type { AddressRow } from "@/lib/supabase/addresses.types";
import { filterAddresses, type AddressFilters } from "./addressFilters";

function makeAddress(overrides: Partial<AddressRow> = {}): AddressRow {
  return {
    id: "id-1",
    project: "Самокат",
    city: "Москва",
    position: "Курьер",
    full_address: "ул. Ленина, 1",
    metro: "Текстильщики",
    district: "Южный",
    latitude: null,
    longitude: null,
    object_type: "darkstore",
    required_count: 0,
    staffed_count: 0,
    planned_start_count: 0,
    in_progress_count: 0,
    status: "unrestricted",
    priority: 3,
    schedule_type: null,
    shift_type: null,
    shift_times: [],
    payment_type: null,
    payment_amount: null,
    coordinator_name: "Иванов И.И.",
    coordinator_phone: null,
    coordinator_telegram: null,
    site_manager_name: "Петров П.П.",
    site_manager_phone: null,
    coordinator_comment: null,
    features: [],
    document_links: [],
    archived_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    created_by: null,
    created_by_login: null,
    updated_by: null,
    updated_by_login: null,
    source: "manual",
    import_id: null,
    ...overrides,
  };
}

const noFilters: AddressFilters = {
  search: "",
  project: "",
  city: "",
  position: "",
  district: "",
  metro: "",
  objectType: "",
  status: "",
  priority: 0,
  coordinator: "",
  showArchived: false,
};

describe("filterAddresses", () => {
  it("excludes archived addresses unless showArchived is true", () => {
    const rows = [makeAddress({ id: "1" }), makeAddress({ id: "2", archived_at: "2026-07-10T00:00:00.000Z" })];
    expect(filterAddresses(rows, noFilters).map((a) => a.id)).toEqual(["1"]);
    expect(filterAddresses(rows, { ...noFilters, showArchived: true }).map((a) => a.id)).toEqual(["2"]);
  });

  it("applies exact-match filters (project/city/position/district/metro/objectType/status/priority/coordinator)", () => {
    const rows = [
      makeAddress({ id: "1", project: "Самокат" }),
      makeAddress({ id: "2", project: "Купер" }),
    ];
    expect(filterAddresses(rows, { ...noFilters, project: "Купер" }).map((a) => a.id)).toEqual(["2"]);
  });

  it("matches search against full address, metro, district, city, coordinator and site manager at once", () => {
    const rows = [
      makeAddress({ id: "1", full_address: "ул. Ленина, 1" }),
      makeAddress({ id: "2", metro: "Спортивная", full_address: "пр. Мира, 5" }),
      makeAddress({ id: "3", coordinator_name: "Сидорова А.А.", full_address: "пр. Мира, 9" }),
      makeAddress({ id: "4", site_manager_name: "Кузнецов Д.Д.", full_address: "пр. Мира, 12" }),
    ];
    expect(filterAddresses(rows, { ...noFilters, search: "ленина" }).map((a) => a.id)).toEqual(["1"]);
    expect(filterAddresses(rows, { ...noFilters, search: "спортивная" }).map((a) => a.id)).toEqual(["2"]);
    expect(filterAddresses(rows, { ...noFilters, search: "сидорова" }).map((a) => a.id)).toEqual(["3"]);
    expect(filterAddresses(rows, { ...noFilters, search: "кузнецов" }).map((a) => a.id)).toEqual(["4"]);
  });

  it("search is case-insensitive", () => {
    const rows = [makeAddress({ id: "1", full_address: "Ул. Ленина, 1" })];
    expect(filterAddresses(rows, { ...noFilters, search: "УЛ. ЛЕНИНА" }).map((a) => a.id)).toEqual(["1"]);
  });

  it("priority filter 0 means 'all priorities'", () => {
    const rows = [makeAddress({ id: "1", priority: 5 }), makeAddress({ id: "2", priority: 1 })];
    expect(filterAddresses(rows, noFilters)).toHaveLength(2);
    expect(filterAddresses(rows, { ...noFilters, priority: 5 }).map((a) => a.id)).toEqual(["1"]);
  });

  it("does not mutate the input array", () => {
    const rows = [makeAddress({ id: "1" })];
    const snapshot = JSON.parse(JSON.stringify(rows));
    filterAddresses(rows, { ...noFilters, search: "x" });
    expect(rows).toEqual(snapshot);
  });
});
