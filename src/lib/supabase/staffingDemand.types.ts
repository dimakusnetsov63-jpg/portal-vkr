import type { Database } from "./database.types";

/** A row from public.staffing_demand, as returned by SELECT. */
export type StaffingDemandRow = Database["public"]["Tables"]["staffing_demand"]["Row"];

/** Payload accepted by INSERT into public.staffing_demand. */
export type StaffingDemandInsert = Database["public"]["Tables"]["staffing_demand"]["Insert"];

/** Payload accepted by UPDATE on public.staffing_demand. */
export type StaffingDemandUpdate = Database["public"]["Tables"]["staffing_demand"]["Update"];

export type StaffingDemandSource = "manual" | "excel";
