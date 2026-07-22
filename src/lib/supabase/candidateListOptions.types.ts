import type { Database } from "./database.types";

/** A row from public.candidate_list_options, as returned by SELECT. */
export type CandidateListOption = Database["public"]["Tables"]["candidate_list_options"]["Row"];

/** Payload accepted by INSERT into public.candidate_list_options. */
export type CandidateListOptionInsert = Database["public"]["Tables"]["candidate_list_options"]["Insert"];

/** Payload accepted by UPDATE on public.candidate_list_options. */
export type CandidateListOptionUpdate = Database["public"]["Tables"]["candidate_list_options"]["Update"];

/** Which free-text candidate field a list option's value is a suggestion for. */
export type CandidateListType = Database["public"]["Enums"]["candidate_list_type"];
