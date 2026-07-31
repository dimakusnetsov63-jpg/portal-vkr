import { createClient } from "./client";
import type { Database } from "./database.types";
import type { RateCardInsert, RateCardRow, RateCardUpdate, RateInsert, RateRow, RateUpdate } from "./rates.types";

/**
 * `extras` is a plain `Json` column in the generated `Database` type (jsonb
 * is typed maximally broadly) — this app always stores/reads the narrower
 * `{id, label, value}[]` shape there (see rates.types.ts), so the casts
 * below are a documented assumption, not a loophole: nothing else ever
 * writes to this column. Same pattern as addressesRepo.ts asAddressRow.
 */
function asRateRow(row: unknown): RateRow {
  return row as RateRow;
}

type RatesInsertPayload = Database["public"]["Tables"]["rates"]["Insert"];
type RatesUpdatePayload = Database["public"]["Tables"]["rates"]["Update"];

function toRateInsertPayload(input: RateInsert): RatesInsertPayload {
  return input as unknown as RatesInsertPayload;
}

function toRateUpdatePayload(patch: RateUpdate): RatesUpdatePayload {
  return patch as unknown as RatesUpdatePayload;
}

/** All rate cards, newest first. Loaded once on mount — see PortalContext.refreshRates. */
export async function listRateCards(): Promise<RateCardRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rate_cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** All rate rows, ordered for stable display within a card (sort_order, then position as a tiebreaker). */
export async function listRates(): Promise<RateRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return data.map(asRateRow);
}

/**
 * Returns the rate card for (project, city, legalEntity), creating it with
 * empty conditions if it doesn't exist yet. Race-safe: `upsert` with
 * `ignoreDuplicates` lets a concurrent insert win instead of erroring, then
 * the row is always re-read by its natural key.
 */
export async function findOrCreateRateCard(project: string, city: string, legalEntity: string): Promise<RateCardRow> {
  const supabase = createClient();
  const { error: upsertError } = await supabase
    .from("rate_cards")
    .upsert(
      { project, city, legal_entity: legalEntity } satisfies RateCardInsert,
      { onConflict: "project,city,legal_entity", ignoreDuplicates: true },
    );
  if (upsertError) throw upsertError;

  const { data, error } = await supabase
    .from("rate_cards")
    .select("*")
    .eq("project", project)
    .eq("city", city)
    .eq("legal_entity", legalEntity)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRateCard(id: string, patch: RateCardUpdate): Promise<RateCardRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("rate_cards").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** Deletes a rate card and, via ON DELETE CASCADE, every rate row that belongs to it. */
export async function deleteRateCard(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("rate_cards").delete().eq("id", id);
  if (error) throw error;
}

export async function createRate(input: RateInsert): Promise<RateRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("rates").insert(toRateInsertPayload(input)).select().single();
  if (error) throw error;
  return asRateRow(data);
}

export async function updateRate(id: string, patch: RateUpdate): Promise<RateRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rates")
    .update(toRateUpdatePayload(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return asRateRow(data);
}

export async function deleteRate(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("rates").delete().eq("id", id);
  if (error) throw error;
}
