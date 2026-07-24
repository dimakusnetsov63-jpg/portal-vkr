import { createClient } from "./client";
import type { StaffingDemandRowMeta } from "./staffingDemandRows.types";

/** All row-level metadata (status + comment), across all projects/cities — loaded once, not windowed by date. */
export async function listStaffingDemandRowsMeta(): Promise<StaffingDemandRowMeta[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("staffing_demand_rows").select("*");
  if (error) throw error;
  return data;
}

/** Upsert one row's status + comment, keyed on (project, city) via the table's unique constraint. */
export async function upsertStaffingDemandRowMeta(
  project: string,
  city: string,
  status: string,
  comment: string | null,
): Promise<StaffingDemandRowMeta> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand_rows")
    .upsert({ project, city, status, comment }, { onConflict: "project,city" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
