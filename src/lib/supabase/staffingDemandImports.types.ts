import type { Database } from "./database.types";
import type { RowError } from "@/lib/imports/types";

type StaffingDemandImportsTable = Database["public"]["Tables"]["staffing_demand_imports"];

/** "success" — no row errors; "partial" — some rows imported, some rejected; "failed" — every row rejected; "reverted" — undone via revertImport.ts. */
export type ImportStatus = "success" | "partial" | "failed" | "reverted";

/** error_log/warnings are Json in the generated type — the app always reads/writes RowError[]/string[], same convention as AddressRow.document_links. */
export type StaffingDemandImportRow = Omit<StaffingDemandImportsTable["Row"], "error_log" | "warnings" | "status"> & {
  error_log: RowError[];
  warnings: string[];
  status: ImportStatus;
};

/** Payload accepted by INSERT into public.staffing_demand_imports — see createImportRecord in staffingDemandImportsRepo.ts. */
export type StaffingDemandImportInsert = Omit<
  StaffingDemandImportsTable["Insert"],
  "error_log" | "warnings" | "status"
> & {
  error_log?: RowError[];
  warnings?: string[];
  status: ImportStatus;
};
