import { createClient } from "./client";
import type { StaffingDemandHistoryRow } from "./staffingDemandHistory.types";

/**
 * History entries for one demand cell (project + city + position + exact
 * date), newest first. Only ever called on demand (when the "История
 * изменений" drawer opens) — never loaded eagerly for the whole matrix.
 *
 * Filtering by an exact `demand_date` naturally excludes the
 * staffing_demand_rows (status/comment) entries too: those rows have
 * `demand_date = null`, and `null = <date>` is never true in SQL.
 */
export async function listStaffingDemandCellHistory(
  project: string,
  city: string,
  position: string,
  demandDate: string,
): Promise<StaffingDemandHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_demand_history")
    .select("*")
    .eq("project", project)
    .eq("city", city)
    .eq("position", position)
    .eq("demand_date", demandDate)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data;
}
