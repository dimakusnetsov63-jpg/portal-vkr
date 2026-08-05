import { createClient } from "./client";
import type { StaffingDemandImportInsert, StaffingDemandImportRow } from "./staffingDemandImports.types";

/** Writes one import-history record. Called once per real (non-dry-run) import, after the rows are written — see importDemand.ts. */
export async function createImportRecord(insert: StaffingDemandImportInsert): Promise<StaffingDemandImportRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("staffing_demand_imports").insert(insert).select().single();
  if (error) throw error;
  return data as unknown as StaffingDemandImportRow;
}

/** Import history for the settings panel — head-only per RLS, newest first. */
export async function listImportHistory(limit = 50): Promise<StaffingDemandImportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as StaffingDemandImportRow[];
}

/** Marks an import as reverted after revertImport.ts has deleted its rows. */
export async function markImportReverted(importId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("staffing_demand_imports").update({ status: "reverted" }).eq("id", importId);
  if (error) throw error;
}
