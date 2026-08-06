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

/** Active (non-archived) cards of one project — what the Excel import matches its rows against by (project, city, full_address, position). Scoped to one project because that is all an import ever touches. */
export async function listActiveAddressesForProject(project: string): Promise<AddressRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("project", project)
    .is("archived_at", null);
  if (error) throw error;
  return data.map(asAddressRow);
}

/** Creates the cards an import found no match for. `source`/`import_id` mark them as import-made so revertImport can remove exactly these. */
export async function bulkInsertAddressesFromImport(rows: AddressInsert[], importId: string): Promise<AddressRow[]> {
  if (rows.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .insert(rows.map((row) => toInsertPayload({ ...row, source: "excel", import_id: importId })))
    .select();
  if (error) throw error;
  return data.map(asAddressRow);
}

/** Applies the import's patches (required_count, plus any working conditions the card was still missing) to cards it matched. One request per card — an import touches at most a few hundred, and there is no bulk-update-by-id in PostgREST that would not also need every NOT NULL column restated. */
export async function bulkUpdateAddressesFromImport(updates: { id: string; patch: AddressUpdate }[]): Promise<void> {
  for (const { id, patch } of updates) {
    await updateAddress(id, patch);
  }
}

/** Removes the cards an import created, for "Отменить последний импорт". Cards it merely updated keep their (already overwritten) required_count — see revertImport.ts. */
export async function deleteAddressesByImportId(importId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("addresses").delete().eq("import_id", importId);
  if (error) throw error;
}

export async function archiveAddress(id: string): Promise<AddressRow> {
  return updateAddress(id, { archived_at: new Date().toISOString() });
}

export async function restoreAddress(id: string): Promise<AddressRow> {
  return updateAddress(id, { archived_at: null });
}
