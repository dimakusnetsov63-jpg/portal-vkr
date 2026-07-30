import { createClient } from "./client";
import type { Database } from "./database.types";
import type { AddressInsert, AddressRow, AddressUpdate } from "./addresses.types";

/**
 * `document_links` is a plain `Json` column in the generated `Database`
 * type (jsonb is typed maximally broadly) — this app always stores/reads
 * the narrower `{id, title, url, type}[]` shape there (see
 * addresses.types.ts), so the casts below are a documented assumption, not
 * a loophole: nothing else ever writes to this column.
 */
function asAddressRow(row: unknown): AddressRow {
  return row as AddressRow;
}

type AddressesInsertPayload = Database["public"]["Tables"]["addresses"]["Insert"];
type AddressesUpdatePayload = Database["public"]["Tables"]["addresses"]["Update"];

function toInsertPayload(input: AddressInsert): AddressesInsertPayload {
  return input as unknown as AddressesInsertPayload;
}

function toUpdatePayload(patch: AddressUpdate): AddressesUpdatePayload {
  return patch as unknown as AddressesUpdatePayload;
}

/** All addresses (active and archived), newest first. Loaded once on mount — see PortalContext.refreshAddresses. */
export async function listAddresses(): Promise<AddressRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(asAddressRow);
}

export async function createAddress(input: AddressInsert): Promise<AddressRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("addresses").insert(toInsertPayload(input)).select().single();
  if (error) throw error;
  return asAddressRow(data);
}

export async function updateAddress(id: string, patch: AddressUpdate): Promise<AddressRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .update(toUpdatePayload(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return asAddressRow(data);
}

export async function archiveAddress(id: string): Promise<AddressRow> {
  return updateAddress(id, { archived_at: new Date().toISOString() });
}

export async function restoreAddress(id: string): Promise<AddressRow> {
  return updateAddress(id, { archived_at: null });
}
