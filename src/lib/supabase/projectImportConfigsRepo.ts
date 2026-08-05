import { createClient } from "./client";
import type { ProjectImportConfigRow } from "./projectImportConfigs.types";

/** The enabled config for one project — the row importDemand.ts needs to pick a parser and column mapping. Throws if the project has no config, since ТЗ requires every registered project to have exactly one parser. */
export async function getImportConfigForProject(project: string): Promise<ProjectImportConfigRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_import_configs")
    .select("*")
    .eq("project", project)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Для проекта «${project}» не настроен парсер импорта`);
  return data as unknown as ProjectImportConfigRow;
}
