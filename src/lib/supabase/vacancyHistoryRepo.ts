import { createClient } from "./client";
import type { VacancyHistoryRow } from "./vacancyProjects.types";

/** Только чтение — vacancy_history пишут исключительно SECURITY DEFINER-триггеры (см. миграцию). Грузится лениво при открытии панели «История». */
export async function listVacancyProjectHistory(projectId: string): Promise<VacancyHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vacancy_history")
    .select("*")
    .eq("vacancy_project_id", projectId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data as unknown as VacancyHistoryRow[];
}
