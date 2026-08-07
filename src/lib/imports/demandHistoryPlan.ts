import { objectKey } from "./addressPlan";
import type { ImportPreviewRow } from "./preview";
import type { AddressRow } from "../supabase/addresses.types";
import type { AddressDemandHistoryInsert } from "../supabase/addressDemandHistory.types";

/**
 * Turns one import's preview (create/update/zero, each already carrying the
 * post-write `required` count from `planAddressWrites`) into one
 * `address_demand_history` snapshot row per touched card, for the
 * user-chosen "Дата потребности".
 *
 * Needs both the pre-write cards (`existingCards` — matched objects and
 * zeroed cards already have an id there) and the freshly inserted ones
 * (`insertedCards` — new cards only get an id after the insert) to resolve
 * each preview row's `address_id`. Both are matched by the same
 * project+city+position+address key the rest of the import already uses
 * (`objectKey`, from `addressPlan.ts` — that file itself is not modified;
 * only its export is reused here).
 */
export function buildHistoryRows(
  preview: ImportPreviewRow[],
  existingCards: AddressRow[],
  insertedCards: AddressRow[],
  demandDate: string,
  importId: string,
): AddressDemandHistoryInsert[] {
  const idByKey = new Map<string, string>();
  for (const card of [...existingCards, ...insertedCards]) {
    if (!card.position) continue;
    idByKey.set(objectKey(card.project, card.city, card.position, card.full_address), card.id);
  }

  const rows: AddressDemandHistoryInsert[] = [];
  for (const row of preview) {
    const addressId = idByKey.get(objectKey(row.project, row.city, row.position, row.address));
    // Не должно происходить — каждая строка preview пришла либо из
    // existingCards (update/zero), либо стала insertedCards (create).
    // Пропускаем защитно, а не бросаем: одна не найденная карточка не
    // должна валить остальную часть уже выполненного импорта.
    if (!addressId) continue;
    rows.push({
      address_id: addressId,
      project: row.project,
      city: row.city,
      position: row.position,
      demand_date: demandDate,
      required_count: row.required,
      import_id: importId,
    });
  }
  return rows;
}
