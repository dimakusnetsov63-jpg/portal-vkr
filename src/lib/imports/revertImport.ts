import { deleteStaffingDemandByImportId } from "../supabase/staffingDemandRepo";
import { markImportReverted } from "../supabase/staffingDemandImportsRepo";
import type { StaffingDemandImportRow } from "../supabase/staffingDemandImports.types";

/**
 * Undoes an import by deleting every staffing_demand row still stamped with
 * its import_id. This is a full, safe undo only when the import ran in
 * "Заменить" mode or created purely new rows — deleting rows that "Добавить"
 * incremented back to their pre-import planned_count is not possible without
 * a stored snapshot of "before" values (out of scope, see
 * docs/requirements/addresses.md). The UI only offers this action when
 * `canRevert(import)` is true; this function itself does not re-check the
 * mode, since by the time it is called the caller has already decided.
 */
export async function revertImport(importRecord: StaffingDemandImportRow): Promise<void> {
  await deleteStaffingDemandByImportId(importRecord.id);
  await markImportReverted(importRecord.id);
}

/** An import can be losslessly undone only if it replaced (mode "Заменить") or created purely new rows (updated_rows === 0) — see revertImport's doc comment. */
export function canRevertImport(importRecord: StaffingDemandImportRow): boolean {
  if (importRecord.status === "reverted" || importRecord.dry_run) return false;
  return importRecord.mode === "replace" || importRecord.updated_rows === 0;
}
