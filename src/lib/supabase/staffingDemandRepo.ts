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

/** Upsert one cell, keyed on (project, city, position, demand_date) via the table's unique constraint. */
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
      { project, city, position, demand_date: demandDate, planned_count: plannedCount },
      { onConflict: "project,city,position,demand_date" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Physically remove one cell (clearing it back to "not set"). No-op if the row doesn't exist. */
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
    .eq("demand_date", demandDate);
  if (error) throw error;
}

/** Bulk upsert for the "Добавить потребность" modal: one row per (city × position × date) in the range, same planned_count for all. */
export async function bulkUpsertStaffingDemand(
  rows: { project: string; city: string; position: string; demand_date: string; planned_count: number }[],
): Promise<StaffingDemandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand")
    .upsert(rows, { onConflict: "project,city,position,demand_date" })
    .select();
  if (error) throw error;
  return data;
}
