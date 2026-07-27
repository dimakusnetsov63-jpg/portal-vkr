import { createClient } from "./client";
import type { StaffingDemandRowMeta } from "./staffingDemandRows.types";

/** All row-level metadata (status + comment), across all projects/cities/positions — loaded once, not windowed by date. */
export async function listStaffingDemandRowsMeta(): Promise<StaffingDemandRowMeta[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("staffing_demand_rows").select("*");
  if (error) throw error;
  return data;
}

/** Upsert one row's status + comment, keyed on (project, city, position) via the table's unique constraint. */
export async function upsertStaffingDemandRowMeta(
  project: string,
  city: string,
  position: string,
  status: string,
  comment: string | null,
): Promise<StaffingDemandRowMeta> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand_rows")
    .upsert({ project, city, position, status, comment }, { onConflict: "project,city,position" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
