import type { Database } from "./database.types";

/** A row from public.staffing_demand_rows, as returned by SELECT. */
export type StaffingDemandRowMeta = Database["public"]["Tables"]["staffing_demand_rows"]["Row"];

/** Payload accepted by INSERT into public.staffing_demand_rows. */
export type StaffingDemandRowMetaInsert = Database["public"]["Tables"]["staffing_demand_rows"]["Insert"];

/** Payload accepted by UPDATE on public.staffing_demand_rows. */
export type StaffingDemandRowMetaUpdate = Database["public"]["Tables"]["staffing_demand_rows"]["Update"];
