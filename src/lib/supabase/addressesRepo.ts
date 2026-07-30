import { createAddressesClient } from "./client";
import type { AddressInsert, AddressRow, AddressUpdate } from "./addresses.types";

/** All addresses (active and archived), newest first. Loaded once on mount — see PortalContext.refreshAddresses. */
export async function listAddresses(): Promise<AddressRow[]> {
  const supabase = createAddressesClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAddress(input: AddressInsert): Promise<AddressRow> {
  const supabase = createAddressesClient();
  const { data, error } = await supabase.from("addresses").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateAddress(id: string, patch: AddressUpdate): Promise<AddressRow> {
  const supabase = createAddressesClient();
  const { data, error } = await supabase.from("addresses").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveAddress(id: string): Promise<AddressRow> {
  return updateAddress(id, { archived_at: new Date().toISOString() });
}

export async function restoreAddress(id: string): Promise<AddressRow> {
  return updateAddress(id, { archived_at: null });
}
