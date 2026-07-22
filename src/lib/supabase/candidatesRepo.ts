import { createClient } from "./client";
import type { Candidate, CandidateInsert, CandidateUpdate } from "./candidates.types";

/** All candidates (active and archived), newest first. */
export async function listCandidates(): Promise<Candidate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCandidate(input: CandidateInsert): Promise<Candidate> {
  const supabase = createClient();
  const { data, error } = await supabase.from("candidates").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateCandidate(id: string, patch: CandidateUpdate): Promise<Candidate> {
  const supabase = createClient();
  const { data, error } = await supabase.from("candidates").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveCandidate(id: string): Promise<Candidate> {
  return updateCandidate(id, { archived_at: new Date().toISOString() });
}

export async function restoreCandidate(id: string): Promise<Candidate> {
  return updateCandidate(id, { archived_at: null });
}
