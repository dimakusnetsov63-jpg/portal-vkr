import { describe, expect, it } from "vitest";
import { buildHistoryRows } from "./demandHistoryPlan";
import type { ImportPreviewRow } from "./preview";
import type { AddressRow } from "../supabase/addresses.types";

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

function makePreviewRow(overrides: Partial<ImportPreviewRow> = {}): ImportPreviewRow {
  return {
    action: "update",
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    address: "МСК Снежная 20",
    required: 3,
    ...overrides,
  };
}

const DEMAND_DATE = "2026-08-07";
const IMPORT_ID = "import-1";

describe("buildHistoryRows", () => {
  it("resolves address_id for an update/zero row from existingCards", () => {
    const card = makeCard({ id: "existing-1" });
    const rows = buildHistoryRows([makePreviewRow({ action: "update", required: 5 })], [card], [], DEMAND_DATE, IMPORT_ID);
    expect(rows).toEqual([
      {
        address_id: "existing-1",
        project: "Яндекс Лавка",
        city: "Москва",
        position: "Кладовщик",
        demand_date: DEMAND_DATE,
        required_count: 5,
        import_id: IMPORT_ID,
      },
    ]);
  });

  it("resolves address_id for a create row from insertedCards, not existingCards", () => {
    const inserted = makeCard({ id: "new-1", full_address: "МСК Егерская 1" });
    const rows = buildHistoryRows(
      [makePreviewRow({ action: "create", address: "МСК Егерская 1", required: 2 })],
      [],
      [inserted],
      DEMAND_DATE,
      IMPORT_ID,
    );
    expect(rows).toEqual([
      {
        address_id: "new-1",
        project: "Яндекс Лавка",
        city: "Москва",
        position: "Кладовщик",
        demand_date: DEMAND_DATE,
        required_count: 2,
        import_id: IMPORT_ID,
      },
    ]);
  });

  it("records a zero snapshot for a sync-mode zeroed card", () => {
    const card = makeCard({ id: "stale-1", required_count: 10 });
    const rows = buildHistoryRows(
      [makePreviewRow({ action: "zero", required: 0, previousRequired: 10 })],
      [card],
      [],
      DEMAND_DATE,
      IMPORT_ID,
    );
    expect(rows[0]).toMatchObject({ address_id: "stale-1", required_count: 0 });
  });

  it("matches case-insensitively, like the rest of the import", () => {
    const card = makeCard({ id: "existing-1", full_address: "мск снежная 20" });
    const rows = buildHistoryRows([makePreviewRow()], [card], [], DEMAND_DATE, IMPORT_ID);
    expect(rows[0]!.address_id).toBe("existing-1");
  });

  it("produces one history row per preview row, covering several addresses of the same import", () => {
    const cardA = makeCard({ id: "a", full_address: "МСК А 1" });
    const cardB = makeCard({ id: "b", full_address: "МСК Б 2" });
    const rows = buildHistoryRows(
      [makePreviewRow({ address: "МСК А 1", required: 3 }), makePreviewRow({ address: "МСК Б 2", required: 4 })],
      [cardA, cardB],
      [],
      DEMAND_DATE,
      IMPORT_ID,
    );
    expect(rows.map((r) => [r.address_id, r.required_count])).toEqual([
      ["a", 3],
      ["b", 4],
    ]);
  });

  it("skips a preview row whose card is in neither existingCards nor insertedCards, without throwing", () => {
    const rows = buildHistoryRows([makePreviewRow()], [], [], DEMAND_DATE, IMPORT_ID);
    expect(rows).toEqual([]);
  });

  it("returns an empty array for an empty preview", () => {
    expect(buildHistoryRows([], [makeCard()], [], DEMAND_DATE, IMPORT_ID)).toEqual([]);
  });
});
