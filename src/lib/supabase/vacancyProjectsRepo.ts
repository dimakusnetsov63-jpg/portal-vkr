import { createClient } from "./client";
import { VACANCY_GENERAL_SECTION_SEED } from "@/components/portal/sections/vacancies/vacancyOptions";
import type { Json } from "./database.types";
import type {
  VacancyAttachmentRow,
  VacancyFieldRow,
  VacancyProjectListRow,
  VacancyProjectRow,
  VacancyProjectTree,
  VacancyProjectTreeDraft,
  VacancySectionRow,
  VacancySectionWithChildren,
} from "./vacancyProjects.types";

/** Брошено `saveVacancyProjectTree`, когда кто-то другой уже сохранил вакансию раньше — см. `portal_save_vacancy_project_tree`. */
export class VacancyVersionConflictError extends Error {
  constructor() {
    super("Кто-то уже изменил эту вакансию. Обновите данные и повторите правки.");
    this.name = "VacancyVersionConflictError";
  }
}

const LIST_SELECT = "*, category_option:candidate_list_options(id, value)";

/** Плоский список вакансий (без разделов/полей) для левой панели — дерево грузится лениво в VacancyDetail. */
export async function listVacancyProjects(): Promise<VacancyProjectListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vacancy_projects")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as VacancyProjectListRow[];
}

export async function getVacancyProjectTree(projectId: string): Promise<VacancyProjectTree> {
  const supabase = createClient();

  const { data: projectRow, error: projectError } = await supabase
    .from("vacancy_projects")
    .select(LIST_SELECT)
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: sectionRows, error: sectionsError } = await supabase
    .from("vacancy_sections")
    .select("*")
    .eq("vacancy_project_id", projectId)
    .order("sort_order", { ascending: true });
  if (sectionsError) throw sectionsError;

  const sectionIds = (sectionRows as VacancySectionRow[]).map((s) => s.id);

  const { data: fieldRows, error: fieldsError } = sectionIds.length
    ? await supabase
        .from("vacancy_fields")
        .select("*")
        .in("section_id", sectionIds)
        .order("sort_order", { ascending: true })
    : { data: [] as VacancyFieldRow[], error: null };
  if (fieldsError) throw fieldsError;

  const { data: attachmentRows, error: attachmentsError } = await supabase
    .from("vacancy_attachments")
    .select("*")
    .eq("vacancy_project_id", projectId)
    .order("sort_order", { ascending: true });
  if (attachmentsError) throw attachmentsError;

  const fieldsBySection = new Map<string, VacancyFieldRow[]>();
  for (const field of fieldRows as VacancyFieldRow[]) {
    const list = fieldsBySection.get(field.section_id) ?? [];
    list.push(field);
    fieldsBySection.set(field.section_id, list);
  }

  const attachmentsBySection = new Map<string, VacancyAttachmentRow[]>();
  const generalAttachments: VacancyAttachmentRow[] = [];
  for (const attachment of attachmentRows as VacancyAttachmentRow[]) {
    if (attachment.section_id === null) {
      generalAttachments.push(attachment);
      continue;
    }
    const list = attachmentsBySection.get(attachment.section_id) ?? [];
    list.push(attachment);
    attachmentsBySection.set(attachment.section_id, list);
  }

  const sections: VacancySectionWithChildren[] = (sectionRows as VacancySectionRow[]).map((section) => ({
    ...section,
    fields: fieldsBySection.get(section.id) ?? [],
    attachments: attachmentsBySection.get(section.id) ?? [],
  }));

  return {
    project: projectRow as unknown as VacancyProjectListRow,
    sections,
    generalAttachments,
  };
}

/** Создаёт вакансию и сразу системный раздел «Общая информация» с полями-затравками (`vacancyOptions.ts`). */
export async function createVacancyProject(input: {
  title: string;
  categoryOptionId: string | null;
}): Promise<VacancyProjectRow> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("vacancy_projects")
    .insert({ title: input.title, category_option_id: input.categoryOptionId })
    .select()
    .single();
  if (projectError) throw projectError;

  const { data: section, error: sectionError } = await supabase
    .from("vacancy_sections")
    .insert({
      vacancy_project_id: (project as VacancyProjectRow).id,
      title: "Общая информация",
      icon: "info",
      is_system: true,
      sort_order: 0,
    })
    .select()
    .single();
  if (sectionError) throw sectionError;

  const seedFields = VACANCY_GENERAL_SECTION_SEED.map((field, index) => ({
    section_id: (section as VacancySectionRow).id,
    label: field.label,
    value: "",
    field_type: field.field_type,
    sort_order: index,
  }));
  const { error: fieldsError } = await supabase.from("vacancy_fields").insert(seedFields);
  if (fieldsError) throw fieldsError;

  return project as VacancyProjectRow;
}

export async function archiveVacancyProject(id: string): Promise<VacancyProjectRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vacancy_projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as VacancyProjectRow;
}

export async function restoreVacancyProject(id: string): Promise<VacancyProjectRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vacancy_projects")
    .update({ archived_at: null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as VacancyProjectRow;
}

/** Атомарное сохранение дерева через `portal_save_vacancy_project_tree` — см. миграцию для формы payload'а. */
export async function saveVacancyProjectTree(
  projectId: string,
  expectedVersion: number,
  tree: VacancyProjectTreeDraft,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("portal_save_vacancy_project_tree", {
    p_project_id: projectId,
    p_expected_version: expectedVersion,
    p_payload: tree as unknown as Json,
  });
  if (error) {
    if (error.message?.includes("version_conflict")) {
      throw new VacancyVersionConflictError();
    }
    throw error;
  }
}

/** Возвращает id новой (продублированной) вакансии — вызывающий сам дальше открывает её через getVacancyProjectTree. */
export async function duplicateVacancyProject(id: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("portal_duplicate_vacancy_project", { p_project_id: id });
  if (error) throw error;
  return data as string;
}

/** Id вакансий, где встречается `query` — по названию вакансии/раздела/подписи или значению поля. */
export async function searchVacancyProjects(query: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_vacancy_projects", { p_query: query });
  if (error) throw error;
  return (data as string[]) ?? [];
}
