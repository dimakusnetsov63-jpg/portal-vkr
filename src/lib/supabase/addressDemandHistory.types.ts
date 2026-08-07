import type { Database } from "./database.types";

/** A row from public.address_demand_history, as returned by SELECT. */
export type AddressDemandHistoryRow = Database["public"]["Tables"]["address_demand_history"]["Row"];

/** Payload accepted by INSERT/upsert into public.address_demand_history. */
export type AddressDemandHistoryInsert = Database["public"]["Tables"]["address_demand_history"]["Insert"];
