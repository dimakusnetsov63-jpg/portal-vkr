import { createClient } from "./client";
import type { StaffingDemandRow } from "./staffingDemand.types";

/** All active demand rows whose demand_date falls in [fromDate, toDate] (both ISO, inclusive) — one query for the whole visible period. */
export async function listStaffingDemand(fromDate: string, toDate: string): Promise<StaffingDemandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand")
    .select("*")
    .gte("demand_date", fromDate)
    .lte("demand_date", toDate)
    .order("demand_date", { ascending: true });
  if (error) throw error;
  return data;
}

/** Upsert one cell, keyed on (project, city, position, demand_date, address) via the table's unique constraint. `address: null` matches the manual-entry matrix, which never sets it. */
export async function upsertStaffingDemandCell(
  project: string,
  city: string,
  position: string,
  demandDate: string,
  plannedCount: number,
): Promise<StaffingDemandRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand")
    .upsert(
      { project, city, position, demand_date: demandDate, planned_count: plannedCount, address: null },
      { onConflict: "project,city,position,demand_date,address" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Physically remove one cell (clearing it back to "not set"). No-op if the row doesn't exist. Scoped to address is null — the manual-entry matrix never touches rows an Excel import created for a specific address. */
export async function deleteStaffingDemandCell(
  project: string,
  city: string,
  position: string,
  demandDate: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("staffing_demand")
    .delete()
    .eq("project", project)
    .eq("city", city)
    .eq("position", position)
    .eq("demand_date", demandDate)
    .is("address", null);
  if (error) throw error;
}

/** Bulk upsert for the "Добавить потребность" modal: one row per (city × position × date) in the range, same planned_count for all. Always address: null — manual entry has no address dimension. */
export async function bulkUpsertStaffingDemand(
  rows: { project: string; city: string; position: string; demand_date: string; planned_count: number }[],
): Promise<StaffingDemandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand")
    .upsert(
      rows.map((row) => ({ ...row, address: null })),
      { onConflict: "project,city,position,demand_date,address" },
    )
    .select();
  if (error) throw error;
  return data;
}
