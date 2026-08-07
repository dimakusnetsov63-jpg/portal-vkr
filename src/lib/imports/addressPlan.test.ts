import { describe, expect, it } from "vitest";
import { aggregateByObject, planAddressWrites, type ImportedObject } from "./addressPlan";
import { EMPTY_CONDITIONS, type ImportedConditions } from "./mapping/normalizeConditions";
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
    conditions: EMPTY_CONDITIONS,
    ...overrides,
  };
}

function conditions(overrides: Partial<ImportedConditions> = {}): ImportedConditions {
  return { ...EMPTY_CONDITIONS, ...overrides };
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
    conditions: EMPTY_CONDITIONS,
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
    expect(plan.updates).toEqual([{ id: "card-1", patch: { required_count: 3 } }]);
  });

  it("add mode sums onto the matched card's required_count", () => {
    const plan = planAddressWrites([object], [makeCard({ required_count: 10 })], "add");
    expect(plan.updates).toEqual([{ id: "card-1", patch: { required_count: 13 } }]);
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

describe("planAddressWrites — условия работы", () => {
  const withConditions: ImportedObject = {
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    address: "МСК Снежная 20",
    required: 3,
    conditions: conditions({
      metro: "Владыкино",
      scheduleType: "5/2",
      shiftType: "night",
      features: ["unloading"],
    }),
  };

  it("fills conditions on a newly created card", () => {
    const [created] = planAddressWrites([withConditions], [], "replace").creates;
    expect(created).toMatchObject({
      metro: "Владыкино",
      schedule_type: "5/2",
      shift_type: "night",
      features: ["unloading"],
    });
  });

  it("omits conditions the file did not provide instead of writing nulls", () => {
    const [created] = planAddressWrites([{ ...withConditions, conditions: EMPTY_CONDITIONS }], [], "replace").creates;
    expect(created).not.toHaveProperty("metro");
    expect(created).not.toHaveProperty("schedule_type");
    expect(created).not.toHaveProperty("shift_type");
    expect(created).not.toHaveProperty("features");
  });

  it("fills only the empty fields of an existing card", () => {
    const card = makeCard({ metro: null, schedule_type: "2/2", shift_type: null });
    const [update] = planAddressWrites([withConditions], [card], "replace").updates;
    expect(update!.patch.metro).toBe("Владыкино");
    expect(update!.patch.shift_type).toBe("night");
    // График уже заполнен руками — импорт его не трогает.
    expect(update!.patch).not.toHaveProperty("schedule_type");
  });

  it("never overwrites conditions a coordinator already filled in", () => {
    const card = makeCard({ metro: "Уточнённая станция", schedule_type: "2/2", shift_type: "day" });
    const [update] = planAddressWrites([withConditions], [card], "replace").updates;
    expect(update!.patch).toEqual({ required_count: 3, features: ["unloading"] });
  });

  it("appends imported features without dropping manually ticked ones", () => {
    const card = makeCard({ features: ["free_meals"] });
    const [update] = planAddressWrites([withConditions], [card], "replace").updates;
    expect(update!.patch.features).toEqual(["free_meals", "unloading"]);
  });

  it("does not re-add a feature the card already has", () => {
    const card = makeCard({ features: ["unloading"] });
    const [update] = planAddressWrites([withConditions], [card], "replace").updates;
    expect(update!.patch).not.toHaveProperty("features");
  });
});

describe("planAddressWrites — режим «Синхронизировать»", () => {
  const object: ImportedObject = {
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    address: "МСК Снежная 20",
    required: 3,
    conditions: EMPTY_CONDITIONS,
  };

  /** Карточка, созданная импортом, — именно такие sync и обнуляет. */
  const importedCard = (overrides: Partial<AddressRow> = {}) =>
    makeCard({ source: "excel", import_id: "import-0", required_count: 10, ...overrides });

  it("zeroes an imported card the file no longer mentions", () => {
    const stale = importedCard({ id: "stale", full_address: "МСК Егерская 1" });
    const plan = planAddressWrites([object], [stale], "sync");
    expect(plan.zeroes).toEqual([{ id: "stale", patch: { required_count: 0 } }]);
    // Объект из файла при этом обрабатывается как обычно.
    expect(plan.creates).toHaveLength(1);
  });

  it("does not zero the card the file did mention", () => {
    const matching = importedCard({ id: "matching" });
    const plan = planAddressWrites([object], [matching], "sync");
    expect(plan.zeroes).toEqual([]);
    expect(plan.updates).toEqual([{ id: "matching", patch: { required_count: 3 } }]);
  });

  it("zeroes nothing in replace or add mode", () => {
    const stale = [importedCard({ id: "stale", full_address: "МСК Егерская 1" })];
    expect(planAddressWrites([object], stale, "replace").zeroes).toEqual([]);
    expect(planAddressWrites([object], stale, "add").zeroes).toEqual([]);
  });

  it("leaves manually created cards alone and counts them instead", () => {
    const manual = makeCard({ id: "manual", full_address: "МСК Егерская 1", source: "manual", required_count: 7 });
    const plan = planAddressWrites([object], [manual], "sync");
    expect(plan.zeroes).toEqual([]);
    expect(plan.skippedManual).toBe(1);
  });

  it("skips cards already at zero so the counter reflects real changes", () => {
    const already = importedCard({ id: "already", full_address: "МСК Егерская 1", required_count: 0 });
    const plan = planAddressWrites([object], [already], "sync");
    expect(plan.zeroes).toEqual([]);
    expect(plan.skippedManual).toBe(0);
  });

  it("ignores cards without a position — they never take part in matching", () => {
    const noPosition = importedCard({ id: "no-position", full_address: "МСК Егерская 1", position: null });
    const plan = planAddressWrites([object], [noPosition], "sync");
    expect(plan.zeroes).toEqual([]);
  });

  it("zeroes every imported card of the project when the file yields no objects at all", () => {
    const cards = [
      importedCard({ id: "a", full_address: "МСК А 1" }),
      importedCard({ id: "b", full_address: "МСК Б 2" }),
    ];
    const plan = planAddressWrites([], cards, "sync");
    expect(plan.zeroes.map((z) => z.id)).toEqual(["a", "b"]);
  });

  it("keeps a different position at the same address as a separate object", () => {
    // Файл принёс «Кладовщик» на этот адрес; карточка «Сборщик» на нём же
    // в файле не упомянута и должна обнулиться.
    const otherPosition = importedCard({ id: "picker", position: "Сборщик" });
    const plan = planAddressWrites([object], [otherPosition], "sync");
    expect(plan.zeroes).toEqual([{ id: "picker", patch: { required_count: 0 } }]);
  });
});

describe("planAddressWrites — предпросмотр", () => {
  const object: ImportedObject = {
    project: "Яндекс Лавка",
    city: "Москва",
    position: "Кладовщик",
    address: "МСК Снежная 20",
    required: 3,
    conditions: EMPTY_CONDITIONS,
  };

  it("reports a create with no previous value", () => {
    const plan = planAddressWrites([object], [], "replace");
    expect(plan.preview).toEqual([
      { action: "create", project: "Яндекс Лавка", city: "Москва", position: "Кладовщик", address: "МСК Снежная 20", required: 3 },
    ]);
  });

  it("reports an update with both the previous and the new value", () => {
    const plan = planAddressWrites([object], [makeCard({ required_count: 10 })], "replace");
    expect(plan.preview).toEqual([
      { action: "update", project: "Яндекс Лавка", city: "Москва", position: "Кладовщик", address: "МСК Снежная 20", required: 3, previousRequired: 10 },
    ]);
  });

  it("reflects add mode's summed value in the preview, not the raw file number", () => {
    const plan = planAddressWrites([object], [makeCard({ required_count: 10 })], "add");
    expect(plan.preview[0]!.required).toBe(13);
    expect(plan.preview[0]!.previousRequired).toBe(10);
  });

  it("reports a sync zero alongside the ordinary rows in the same file", () => {
    const stale = makeCard({ id: "stale", full_address: "МСК Егерская 1", source: "excel", required_count: 7 });
    const plan = planAddressWrites([object], [stale], "sync");
    expect(plan.preview).toContainEqual({
      action: "zero",
      project: "Яндекс Лавка",
      city: "Москва",
      position: "Кладовщик",
      address: "МСК Егерская 1",
      required: 0,
      previousRequired: 7,
    });
    expect(plan.preview).toContainEqual(expect.objectContaining({ action: "create", address: "МСК Снежная 20" }));
  });

  it("does not include a manually created card that sync skips", () => {
    const manual = makeCard({ id: "manual", full_address: "МСК Егерская 1", source: "manual", required_count: 7 });
    const plan = planAddressWrites([object], [manual], "sync");
    expect(plan.preview.some((row) => row.action === "zero")).toBe(false);
  });
});

describe("aggregateByObject — условия работы", () => {
  it("takes the first non-empty value across tickets of the same object", () => {
    const [object] = aggregateByObject([
      makeRow({ conditions: conditions({ metro: null, scheduleType: "5/2" }) }),
      makeRow({ conditions: conditions({ metro: "Владыкино", scheduleType: "2/2" }) }),
    ]);
    expect(object!.conditions.metro).toBe("Владыкино");
    // Первый тикет уже задал график — второй его не переопределяет.
    expect(object!.conditions.scheduleType).toBe("5/2");
  });

  it("unions features across tickets of the same object", () => {
    const [object] = aggregateByObject([
      makeRow({ conditions: conditions({ features: ["unloading"] }) }),
      makeRow({ conditions: conditions({ features: ["unloading", "free_meals"] }) }),
    ]);
    expect(object!.conditions.features).toEqual(["unloading", "free_meals"]);
  });
});
