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

/** Reads existing rows for a set of (project, city, position, demand_date, address) keys in one batched query — used by the "Добавить" import mode to compute new planned_count = existing + demand without a per-row round-trip. Chunked at 500 keys per request to stay under PostgREST's URL/filter limits for 10k-row imports. */
export async function getStaffingDemandByKeys(
  keys: { project: string; city: string; position: string; demand_date: string; address: string | null }[],
): Promise<StaffingDemandRow[]> {
  if (keys.length === 0) return [];
  const supabase = createClient();
  const CHUNK_SIZE = 500;
  const results: StaffingDemandRow[] = [];
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    const orFilter = chunk
      .map(
        (k) =>
          `and(project.eq.${escapeOrValue(k.project)},city.eq.${escapeOrValue(k.city)},position.eq.${escapeOrValue(k.position)},demand_date.eq.${k.demand_date},${k.address === null ? "address.is.null" : `address.eq.${escapeOrValue(k.address)}`})`,
      )
      .join(",");
    const { data, error } = await supabase.from("staffing_demand").select("*").or(orFilter);
    if (error) throw error;
    results.push(...data);
  }
  return results;
}

/** Escapes a value for use inside a PostgREST `.or()` filter string — commas and parentheses are the filter grammar's own delimiters. */
function escapeOrValue(value: string): string {
  return value.replace(/[,()]/g, "");
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
