import { Constants } from "@/lib/supabase/database.types";
import type { CandidateProject, CandidateStage } from "@/lib/supabase/candidates.types";
import type { BadgeColor } from "@/lib/portal/types";

export const CANDIDATE_PROJECTS: readonly CandidateProject[] = Constants.public.Enums.candidate_project;
export const CANDIDATE_STAGES: readonly CandidateStage[] = Constants.public.Enums.candidate_stage;

const STAGE_COLORS: Record<CandidateStage, BadgeColor> = {
  "Прибыл на проект": "blue",
  "Отработал 1 смену": "amber",
  "Отработал 10 смен": "teal",
  "Завершил вахту": "green",
};

/** Stage badge color; a null stage (not started yet) renders gray. */
export function stageColor(stage: CandidateStage | null): BadgeColor {
  return stage ? STAGE_COLORS[stage] : "gray";
}

export function stageLabel(stage: CandidateStage | null): string {
  return stage ?? "Не начал";
}

export function medicalBookLabel(value: boolean | null): string {
  if (value === null) return "Не указано";
  return value ? "Есть" : "Нет";
}
