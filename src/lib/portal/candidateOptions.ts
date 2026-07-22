import { Constants } from "@/lib/supabase/database.types";
import type { CandidateProject, CandidateStage } from "@/lib/supabase/candidates.types";
import type { CandidateListOption, CandidateListType } from "@/lib/supabase/candidateListOptions.types";
import type { BadgeColor } from "@/lib/portal/types";

export const CANDIDATE_PROJECTS: readonly CandidateProject[] = Constants.public.Enums.candidate_project;
export const CANDIDATE_STAGES: readonly CandidateStage[] = Constants.public.Enums.candidate_stage;
export const CANDIDATE_LIST_TYPES: readonly CandidateListType[] = Constants.public.Enums.candidate_list_type;

export const LIST_TYPE_LABELS: Record<CandidateListType, string> = {
  recruiter: "Рекрутеры",
  manager: "Менеджеры",
  coordinator: "Координаторы",
  city: "Города",
};

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

/** Active suggestion values for a given list type, in their configured order. */
export function activeListOptions(options: CandidateListOption[], listType: CandidateListType): CandidateListOption[] {
  return options
    .filter((o) => o.list_type === listType && o.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}
