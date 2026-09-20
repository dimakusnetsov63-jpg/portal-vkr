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
  it("counts active/archived from the full dataset, ignoring the current filter", () => {
    const all = [
      makeAddress({ id: "1", archived_at: null }),
      makeAddress({ id: "2", archived_at: null }),
      makeAddress({ id: "3", archived_at: "2026-07-10T00:00:00.000Z" }),
    ];
    // Simulate a filter that only matched address "1" (e.g. by project) —
    // active/archived must not be affected by that.
    const m = calculateAddressMetrics(all, [all[0]]);
    expect(m.active).toBe(2);
    expect(m.archived).toBe(1);
  });

  it("counts only addresses with open demand, unlike active/archived", () => {
    const rows = [
      makeAddress({ id: "1", required_count: 3 }),
      makeAddress({ id: "2", required_count: 0 }), // обнулён прошлой синхронизацией
      makeAddress({ id: "3", required_count: 1 }),
    ];
    const m = calculateAddressMetrics(rows, rows);
    expect(m.withDemand).toBe(2);
    expect(m.active).toBe(3); // сама карточка никуда не делась
  });

  it("leaves zeroed addresses out of every demand KPI, not just the count", () => {
    const rows = [
      makeAddress({ id: "1", required_count: 10, staffed_count: 4, priority: 5 }),
      // Обнулённый объект с критическим приоритетом и людьми на смене: по нему
      // сейчас никого не ищут, поэтому он не критичный и не укомплектованный.
      makeAddress({ id: "2", required_count: 0, staffed_count: 7, priority: 5 }),
    ];
    const m = calculateAddressMetrics(rows, rows);
    expect(m.criticalCount).toBe(1);
    expect(m.closedPositions).toBe(4);
    expect(m.avgFillRatePct).toBe(40); // только карточка «1»: 4/10
  });

  it("sums required/staffed and clamps unclosed demand at 0 for overstaffed addresses", () => {
    const active = [
      makeAddress({ id: "1", required_count: 10, staffed_count: 4 }), // deficit 6
      makeAddress({ id: "2", required_count: 4, staffed_count: 10 }), // deficit -6, clamped to 0
      makeAddress({ id: "3", required_count: 5, staffed_count: 5 }), // deficit 0
    ];
    const m = calculateAddressMetrics(active, active);
    expect(m.totalDemand).toBe(19);
    expect(m.closedPositions).toBe(19);
    expect(m.openDemand).toBe(6); // 6 + 0 + 0, never negative
  });

  it("counts only priority 5 (Критический) addresses as critical", () => {
    const active = [
      makeAddress({ id: "1", priority: 5, required_count: 1 }),
      makeAddress({ id: "2", priority: 4, required_count: 1 }),
      makeAddress({ id: "3", priority: 5, required_count: 1 }),
    ];
    const m = calculateAddressMetrics(active, active);
    expect(m.criticalCount).toBe(2);
  });

  it("averages per-address fill rate over addresses that actually need people", () => {
    const active = [
      makeAddress({ id: "1", required_count: 10, staffed_count: 10 }), // 100%
      makeAddress({ id: "2", required_count: 10, staffed_count: 0 }), // 0%
      // Без потребности addressFillRate даёт 100%, но в средней по дашборду
      // такая карточка не участвует — иначе показатель съезжает к доле нулей.
      makeAddress({ id: "3", required_count: 0, staffed_count: 0 }),
    ];
    const m = calculateAddressMetrics(active, active);
    expect(m.avgFillRatePct).toBe(50); // (100 + 0) / 2, карточка «3» не в счёте
  });

  it("returns zeros for an empty active/filtered set, never NaN", () => {
    const m = calculateAddressMetrics([], []);
    expect(m).toEqual({
      withDemand: 0,
      active: 0,
      archived: 0,
      totalDemand: 0,
      closedPositions: 0,
      openDemand: 0,
      criticalCount: 0,
      avgFillRatePct: 0,
    });
    for (const v of Object.values(m)) expect(Number.isNaN(v)).toBe(false);
  });

  it("returns zeros when nothing in the filtered set has demand left", () => {
    const zeroed = [makeAddress({ id: "1", required_count: 0 }), makeAddress({ id: "2", required_count: 0 })];
    const m = calculateAddressMetrics(zeroed, zeroed);
    expect(m.withDemand).toBe(0);
    expect(m.avgFillRatePct).toBe(0); // не 100% от «пустых» карточек
    expect(m.active).toBe(2);
  });
});
