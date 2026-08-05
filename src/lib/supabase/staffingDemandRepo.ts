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

/**
 * Reads every existing row for one project on a set of dates — used by the
 * "Добавить" import mode to compute new planned_count = existing + demand
 * without a per-row round-trip. Filters only by `project` + `demand_date in
 * (...)` (both short, low-cardinality values — a handful of unique dates per
 * import) rather than building one `or(and(project=..,city=..,position=..,
 * demand_date=..,address=..))` clause per row: with real data (e.g. ~160
 * distinct addresses for one Lavka import) that approach produced a URL tens
 * of thousands of characters long and PostgREST rejected it with a plain
 * `400`. Matching on the full key (city/position/address) happens in
 * memory in importDemand.ts once the caller has all rows for the relevant
 * dates.
 */
export async function getStaffingDemandForProjectDates(project: string, dates: string[]): Promise<StaffingDemandRow[]> {
  if (dates.length === 0) return [];
  const supabase = createClient();
  const uniqueDates = [...new Set(dates)];
  const { data, error } = await supabase
    .from("staffing_demand")
    .select("*")
    .eq("project", project)
    .in("demand_date", uniqueDates);
  if (error) throw error;
  return data;
}

/** Bulk upsert for an Excel import: same key as bulkUpsertStaffingDemand, but with address/source/import_id set from the import. */
export async function bulkUpsertStaffingDemandFromImport(
  rows: {
    project: string;
    city: string;
    position: string;
    demand_date: string;
    address: string | null;
    planned_count: number;
    import_id: string;
  }[],
): Promise<StaffingDemandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand")
    .upsert(
      rows.map((row) => ({ ...row, source: "excel" as const })),
      { onConflict: "project,city,position,demand_date,address" },
    )
    .select();
  if (error) throw error;
  return data;
}

/** Deletes the rows an import created, for "Отменить последний импорт". Only rows still stamped with this import_id are removed — if a later import touched the same key it will have overwritten import_id already, and this delete correctly leaves it alone. */
export async function deleteStaffingDemandByImportId(importId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("staffing_demand").delete().eq("import_id", importId);
  if (error) throw error;
}
