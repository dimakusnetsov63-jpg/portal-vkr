import { deleteAddressesByImportId } from "../supabase/addressesRepo";
import { deleteAddressDemandHistoryByImportId } from "../supabase/addressDemandHistoryRepo";
import { markImportReverted } from "../supabase/staffingDemandImportsRepo";
import type { StaffingDemandImportRow } from "../supabase/staffingDemandImports.types";

/**
 * Undoes an import by deleting every address card still stamped with its
 * import_id, plus the address_demand_history snapshots it wrote. This is a
 * full, safe undo only when the import created purely new cards: restoring
 * the previous `required_count` of a card the import merely updated would
 * need a stored snapshot of "before" values, which is out of scope (see
 * docs/requirements/addresses.md). The UI only offers this action when
 * `canRevertImport(import)` is true; this function itself does not
 * re-check, since by the time it is called the caller has already decided.
 *
 * No separate step recomputes staffing_demand — there is nothing to
 * recompute. `staffing_demand_effective()` derives its result from
 * address_demand_history on every read, so once these rows are gone the
 * next read of «Потребность» is already correct.
 */
export async function revertImport(importRecord: StaffingDemandImportRow): Promise<void> {
  await deleteAddressDemandHistoryByImportId(importRecord.id);
  await deleteAddressesByImportId(importRecord.id);
  await markImportReverted(importRecord.id);
}

/** An import can be losslessly undone only if it created cards without touching any existing one — both updating and zeroing overwrite a card's previous required_count, and no "before" snapshot is kept. */
export function canRevertImport(importRecord: StaffingDemandImportRow): boolean {
  if (importRecord.status === "reverted" || importRecord.dry_run) return false;
  return importRecord.updated_rows === 0 && importRecord.zeroed_rows === 0;
}
