import type { Database } from "./database.types";

/** A row from public.candidates, as returned by SELECT. */
export type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

/** Payload accepted by INSERT into public.candidates. */
export type CandidateInsert = Database["public"]["Tables"]["candidates"]["Insert"];

/** Payload accepted by UPDATE on public.candidates. */
export type CandidateUpdate = Database["public"]["Tables"]["candidates"]["Update"];

/** Allowed values of candidates.project (public.candidate_project enum). */
export type CandidateProject = Database["public"]["Enums"]["candidate_project"];

/** Allowed values of candidates.stage (public.candidate_stage enum). */
export type CandidateStage = Database["public"]["Enums"]["candidate_stage"];
