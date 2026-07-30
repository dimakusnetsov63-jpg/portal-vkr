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
  it("counts total/active/archived from the full dataset, ignoring the current filter", () => {
    const all = [
      makeAddress({ id: "1", archived_at: null }),
      makeAddress({ id: "2", archived_at: null }),
      makeAddress({ id: "3", archived_at: "2026-07-10T00:00:00.000Z" }),
    ];
    // Simulate a filter that only matched address "1" (e.g. by project) —
    // total/active/archived must not be affected by that.
    const m = calculateAddressMetrics(all, [all[0]]);
    expect(m.total).toBe(3);
    expect(m.active).toBe(2);
    expect(m.archived).toBe(1);
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
      makeAddress({ id: "1", priority: 5 }),
      makeAddress({ id: "2", priority: 4 }),
      makeAddress({ id: "3", priority: 5 }),
    ];
    const m = calculateAddressMetrics(active, active);
    expect(m.criticalCount).toBe(2);
  });

  it("averages per-address fill rate (not a single weighted ratio)", () => {
    const active = [
      makeAddress({ id: "1", required_count: 10, staffed_count: 10 }), // 100%
      makeAddress({ id: "2", required_count: 10, staffed_count: 0 }), // 0%
      makeAddress({ id: "3", required_count: 0, staffed_count: 0 }), // 100% (no demand)
    ];
    const m = calculateAddressMetrics(active, active);
    expect(m.avgFillRatePct).toBe(67); // (100 + 0 + 100) / 3 = 66.67 -> rounds to 67
  });

  it("returns zeros for an empty active/filtered set, never NaN", () => {
    const m = calculateAddressMetrics([], []);
    expect(m).toEqual({
      total: 0,
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
});
