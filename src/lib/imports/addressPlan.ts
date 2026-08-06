import type { DemandImportRow, ImportMode } from "./types";
import type { AddressInsert, AddressRow } from "../supabase/addresses.types";

/** One staffing object as the import understands it: a place + a role, plus how many people it needs. */
export type ImportedObject = {
  project: string;
  city: string;
  position: string;
  address: string;
  required: number;
};

/** What an import intends to write: cards to create, and new required_count values for cards it matched. */
export type AddressWritePlan = {
  creates: AddressInsert[];
  updates: { id: string; required_count: number }[];
};

/**
 * Collapses parsed rows into one entry per (project, city, position,
 * address), summing `demand`. This is what makes "один адрес = один
 * требуемый человек на тикет" work: the Lavka export has one row per open
 * ticket, so three tickets for «Кладовщик» at the same darkstore become one
 * object needing three people. The row's date is intentionally not part of
 * the key — an address card has no date dimension.
 *
 * Rows without an address are skipped: a card cannot exist without
 * `full_address`. importDemand.ts reports those as row errors before
 * calling this.
 */
export function aggregateByObject(rows: DemandImportRow[]): ImportedObject[] {
  const byKey = new Map<string, ImportedObject>();
  for (const row of rows) {
    if (!row.address) continue;
    const key = objectKey(row.project, row.city, row.position, row.address);
    const existing = byKey.get(key);
    if (existing) existing.required += row.demand;
    else
      byKey.set(key, {
        project: row.project,
        city: row.city,
        position: row.position,
        address: row.address,
        required: row.demand,
      });
  }
  return [...byKey.values()];
}

/** Match key for "is this file row the same staffing object as that card?". Case-insensitive so «МСК Снежная 20» and «МСК снежная 20» don't become two cards. */
export function objectKey(project: string, city: string, position: string, address: string): string {
  return [project, city, position, address].map((part) => part.trim().toLowerCase()).join(" ");
}

/**
 * Splits aggregated objects into cards to create and cards to update.
 * "Заменить" sets required_count to the file's number; "Добавить" adds it to
 * whatever the card already had. Cards are matched in memory rather than via
 * a DB unique constraint — public.addresses has none, because it may already
 * contain manually-created duplicates (see the 20260807100000 migration).
 */
export function planAddressWrites(
  objects: ImportedObject[],
  existingCards: AddressRow[],
  mode: ImportMode,
): AddressWritePlan {
  const cardByKey = new Map<string, AddressRow>();
  for (const card of existingCards) {
    // Карточка без специализации не может совпасть со строкой файла — там
    // должность есть всегда (её отсутствие отсекает validateRow).
    if (!card.position) continue;
    cardByKey.set(objectKey(card.project, card.city, card.position, card.full_address), card);
  }

  const creates: AddressInsert[] = [];
  const updates: { id: string; required_count: number }[] = [];

  for (const object of objects) {
    const card = cardByKey.get(objectKey(object.project, object.city, object.position, object.address));
    if (card) {
      updates.push({
        id: card.id,
        required_count: mode === "add" ? card.required_count + object.required : object.required,
      });
    } else {
      // Остальные поля карточки (метро, район, тип объекта, статус,
      // приоритет, укомплектованность) в выгрузке отсутствуют — остаются
      // дефолтными, координатор дозаполняет их вручную в карточке адреса.
      creates.push({
        project: object.project,
        city: object.city,
        position: object.position,
        full_address: object.address,
        required_count: object.required,
      });
    }
  }

  return { creates, updates };
}
