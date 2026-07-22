import { createClient } from "./client";
import type {
  CandidateListOption,
  CandidateListOptionUpdate,
  CandidateListType,
} from "./candidateListOptions.types";

/** All suggestion values (active and inactive) across all list types, ordered for stable display. */
export async function listCandidateListOptions(): Promise<CandidateListOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidate_list_options")
    .select("*")
    .order("list_type", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCandidateListOption(
  listType: CandidateListType,
  value: string,
  sortOrder: number,
): Promise<CandidateListOption> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidate_list_options")
    .insert({ list_type: listType, value, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Generic patch — used for renaming, toggling is_active, and swapping sort_order on reorder. */
export async function updateCandidateListOption(
  id: string,
  patch: CandidateListOptionUpdate,
): Promise<CandidateListOption> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidate_list_options")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// No hard-delete function on purpose: candidate_list_options rows are never
// physically deleted, only deactivated (is_active = false) via
// updateCandidateListOption — see the migration notes.
