import type { Database } from "./database.types";

/** A row from public.staffing_demand_history, as returned by SELECT. */
export type StaffingDemandHistoryRow = Database["public"]["Tables"]["staffing_demand_history"]["Row"];

/** insert | update | delete — the action that produced this history entry. */
export type StaffingDemandHistoryAction = Database["public"]["Enums"]["staffing_demand_history_action"];
