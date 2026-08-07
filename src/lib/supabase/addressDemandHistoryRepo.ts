import { createClient } from "./client";
import type { AddressDemandHistoryInsert } from "./addressDemandHistory.types";

/** Writes one snapshot per (address, date) from an import. Re-importing the same date for the same address updates the existing snapshot rather than creating another — the unique key on (address_id, demand_date) makes this an ordinary upsert. */
export async function upsertAddressDemandHistory(rows: AddressDemandHistoryInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("address_demand_history")
    .upsert(rows, { onConflict: "address_id,demand_date" });
  if (error) throw error;
}

/** Removes every snapshot an import wrote — for "Отменить последний импорт". staffing_demand_effective() re-derives its result from whatever history remains on the next read; no separate recompute step is needed. */
export async function deleteAddressDemandHistoryByImportId(importId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("address_demand_history").delete().eq("import_id", importId);
  if (error) throw error;
}
