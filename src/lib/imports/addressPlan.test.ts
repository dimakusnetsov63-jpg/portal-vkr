import { describe, expect, it } from "vitest";
import { aggregateByObject, planAddressWrites, type ImportedObject } from "./addressPlan";
import type { DemandImportRow } from "./types";
import type { AddressRow } from "../supabase/addresses.types";

function makeRow(overrides: Partial<DemandImportRow> = {}): DemandImportRow {
  return {
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    date: "2026-07-31",
    demand: 1,
    address: "МСК Снежная 20",
    ...overrides,
  };
}

function makeCard(overrides: Partial<AddressRow> = {}): AddressRow {
  return {
    id: "card-1",
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    full_address: "МСК Снежная 20",
    required_count: 0,
    staffed_count: 0,
    planned_start_count: 0,
    in_progress_count: 0,
    metro: null,
    district: null,
    latitude: null,
    longitude: null,
    object_type: "other",
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
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    created_by: null,
    created_by_login: null,
    updated_by: null,
    updated_by_login: null,
    source: "manual",
    import_id: null,
    ...overrides,
  };
}

describe("aggregateByObject", () => {
  it("sums several tickets for the same object+position into one entry", () => {
    const result = aggregateByObject([makeRow(), makeRow(), makeRow()]);
    expect(result).toHaveLength(1);
    expect(result[0]!.required).toBe(3);
  });

  it("ignores the ticket date when grouping — an address card has no date", () => {
    const result = aggregateByObject([makeRow({ date: "2026-07-20" }), makeRow({ date: "2026-07-31" })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.required).toBe(2);
  });

  it("keeps different positions at the same address apart", () => {
    const result = aggregateByObject([makeRow({ position: "Кладовщик" }), makeRow({ position: "Сборщик" })]);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.required)).toEqual([1, 1]);
  });

  it("keeps different addresses apart", () => {
    const result = aggregateByObject([makeRow({ address: "МСК Снежная 20" }), makeRow({ address: "МСК Егерская 1" })]);
    expect(result).toHaveLength(2);
  });

  it("groups case-insensitively so casing differences don't split an object", () => {
    const result = aggregateByObject([makeRow({ address: "МСК Снежная 20" }), makeRow({ address: "мск снежная 20" })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.required).toBe(2);
  });

  it("respects an explicit demand greater than 1", () => {
    const result = aggregateByObject([makeRow({ demand: 5 }), makeRow({ demand: 2 })]);
    expect(result[0]!.required).toBe(7);
  });

  it("skips rows with no address — a card cannot exist without full_address", () => {
    expect(aggregateByObject([makeRow({ address: null })])).toEqual([]);
  });
});

describe("planAddressWrites", () => {
  const object: ImportedObject = {
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    address: "МСК Снежная 20",
    required: 3,
  };

  it("creates a card when nothing matches", () => {
    const plan = planAddressWrites([object], [], "replace");
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toEqual([
      {
        project: "Яндекс Лавка",
        city: "Москва",
        position: "Кладовщик",
        full_address: "МСК Снежная 20",
        required_count: 3,
      },
    ]);
  });

  it("replace mode overwrites the matched card's required_count", () => {
    const plan = planAddressWrites([object], [makeCard({ required_count: 10 })], "replace");
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([{ id: "card-1", required_count: 3 }]);
  });

  it("add mode sums onto the matched card's required_count", () => {
    const plan = planAddressWrites([object], [makeCard({ required_count: 10 })], "add");
    expect(plan.updates).toEqual([{ id: "card-1", required_count: 13 }]);
  });

  it("matches an existing card case-insensitively instead of duplicating it", () => {
    const plan = planAddressWrites([object], [makeCard({ full_address: "мск снежная 20" })], "replace");
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toHaveLength(1);
  });

  it("does not match a card of a different position", () => {
    const plan = planAddressWrites([object], [makeCard({ position: "Сборщик" })], "replace");
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toHaveLength(1);
  });

  it("does not match a card of a different city", () => {
    const plan = planAddressWrites([object], [makeCard({ city: "Казань" })], "replace");
    expect(plan.creates).toHaveLength(1);
  });

  it("ignores cards with no position — they can never correspond to a file row", () => {
    const plan = planAddressWrites([object], [makeCard({ position: null })], "replace");
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toHaveLength(1);
  });

  it("leaves optional card fields unset so they keep their DB defaults", () => {
    const [created] = planAddressWrites([object], [], "replace").creates;
    expect(created).not.toHaveProperty("status");
    expect(created).not.toHaveProperty("priority");
    expect(created).not.toHaveProperty("object_type");
    expect(created).not.toHaveProperty("staffed_count");
  });
});
