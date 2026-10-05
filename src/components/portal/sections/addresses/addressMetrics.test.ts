import { describe, expect, it } from "vitest";
import type { AddressRow } from "@/lib/supabase/addresses.types";
import { addressDeficit, addressFillRate, calculateAddressMetrics } from "./addressMetrics";

/** Build a valid AddressRow; override only the fields a test cares about. */
function makeAddress(overrides: Partial<AddressRow> = {}): AddressRow {
  return {
    id: "id-1",
    project: "Самокат",
    city: "Москва",
    position: "Курьер",
    full_address: "ул. Ленина, 1",
    metro: null,
    district: null,
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
    schedule_types: [],
    shift_type: null,
    shift_times: [],
    payment_type: null,
    payment_amount: null,
    coordinator_name: null,
    coordinator_phone: null,
    coordinator_telegram: null,
    site_manager_name: null,
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

describe("addressDeficit", () => {
  it("is required minus staffed, and may be negative when overstaffed", () => {
    expect(addressDeficit(makeAddress({ required_count: 10, staffed_count: 4 }))).toBe(6);
    expect(addressDeficit(makeAddress({ required_count: 4, staffed_count: 10 }))).toBe(-6);
    expect(addressDeficit(makeAddress({ required_count: 0, staffed_count: 0 }))).toBe(0);
  });
});

describe("addressFillRate", () => {
  it("computes staffed/required * 100", () => {
    expect(addressFillRate(makeAddress({ required_count: 10, staffed_count: 5 }))).toBe(50);
    expect(addressFillRate(makeAddress({ required_count: 4, staffed_count: 4 }))).toBe(100);
  });

  it("is 100% when required_count is 0 — explicit exception to the usual empty/zero -> 0% rule", () => {
    expect(addressFillRate(makeAddress({ required_count: 0, staffed_count: 0 }))).toBe(100);
  });
});

describe("calculateAddressMetrics", () => {
  it("counts active/archived from the filtered sets it is given", () => {
    const active = [makeAddress({ id: "1" }), makeAddress({ id: "2" })];
    const archived = [makeAddress({ id: "3", archived_at: "2026-07-10T00:00:00.000Z" })];
    const m = calculateAddressMetrics(active, archived);
    expect(m.active).toBe(2);
    expect(m.archived).toBe(1);
  });

  it("follows the current filter: a narrower selection gives smaller counters", () => {
    const all = [
      makeAddress({ id: "1", project: "Яндекс Лавка", required_count: 2 }),
      makeAddress({ id: "2", project: "Яндекс Лавка", required_count: 1 }),
      makeAddress({ id: "3", project: "Купер", required_count: 5 }),
    ];
    expect(calculateAddressMetrics(all, []).active).toBe(3);

    // Срез по проекту «Яндекс Лавка» — ровно то, что приходит из
    // filterAddresses, когда в тулбаре выбран проект.
    const oneProject = calculateAddressMetrics(all.slice(0, 2), []);
    expect(oneProject.active).toBe(2);
    expect(oneProject.withDemand).toBe(2);
  });

  it("counts only addresses with open demand, unlike active", () => {
    const rows = [
      makeAddress({ id: "1", required_count: 3 }),
      makeAddress({ id: "2", required_count: 0 }), // обнулён прошлой синхронизацией
      makeAddress({ id: "3", required_count: 1 }),
    ];
    const m = calculateAddressMetrics(rows, []);
    expect(m.withDemand).toBe(2);
    expect(m.active).toBe(3); // сама карточка никуда не делась
  });

  it("returns zeros for an empty set, never NaN", () => {
    const m = calculateAddressMetrics([], []);
    expect(m).toEqual({ withDemand: 0, active: 0, archived: 0 });
    for (const v of Object.values(m)) expect(Number.isNaN(v)).toBe(false);
  });

  it("returns zero with-demand when nothing in the filtered set has demand left", () => {
    const zeroed = [makeAddress({ id: "1", required_count: 0 }), makeAddress({ id: "2", required_count: 0 })];
    const m = calculateAddressMetrics(zeroed, []);
    expect(m.withDemand).toBe(0);
    expect(m.active).toBe(2);
  });
});
