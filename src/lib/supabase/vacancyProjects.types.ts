import type { Database } from "./database.types";

/**
 * Типы для раздела «Описание вакансии» (public.vacancy_projects/
 * vacancy_sections/vacancy_fields/vacancy_attachments/vacancy_history).
 *
 * Row/Insert/Update выведены из `database.types.ts`, как и у остальных
 * реальных разделов (`addresses.types.ts`, `rates.types.ts`) — см.
 * `docs/database/schema.md`. Миграции (`supabase/migrations/20260805*`) в
 * этой задаче не применены и `database.types.ts` не регенерирован (правило
 * 12 CLAUDE.md — это делает пользователь), поэтому ключи
 * `vacancy_projects`/`vacancy_sections`/`vacancy_fields`/
 * `vacancy_attachments`/`vacancy_history` в `Database["public"]["Tables"]`
 * появятся только после `supabase gen types typescript` — до этого момента
 * типы в этом файле не проверяются компилятором. Ожидаемо, не баг.
 *
 * `field_type`/`type` (вложения) в БД — `text` + `CHECK`, не enum (та же
 * причина, что у `addresses.object_type` — список проще расширить без
 * `ALTER TYPE ... ADD VALUE`), поэтому в сгенерированных типах это `string`.
 * Сужение до литералов ниже — только на уровне приложения.
 */

type VacancyProjectsTable = Database["public"]["Tables"]["vacancy_projects"];
type VacancySectionsTable = Database["public"]["Tables"]["vacancy_sections"];
type VacancyFieldsTable = Database["public"]["Tables"]["vacancy_fields"];
type VacancyAttachmentsTable = Database["public"]["Tables"]["vacancy_attachments"];
type VacancyHistoryTable = Database["public"]["Tables"]["vacancy_history"];

export type VacancyFieldType = "text" | "textarea" | "rich_text" | "link" | "number" | "date" | "checkbox" | "select";

export type VacancyAttachmentType = "pdf" | "google_doc" | "video" | "link";

export type VacancyHistoryEntityType = "project" | "section" | "field" | "attachment";
export type VacancyHistoryAction = "insert" | "update" | "delete";

export type VacancyProjectRow = VacancyProjectsTable["Row"];
export type VacancyProjectInsert = VacancyProjectsTable["Insert"];
export type VacancyProjectUpdate = VacancyProjectsTable["Update"];

/** Строка списка вакансий — с подтянутой категорией через embedded-select (`category_option:candidate_list_options(id,value)`). */
export type VacancyProjectListRow = VacancyProjectRow & {
  category_option: { id: string; value: string } | null;
};

export type VacancySectionRow = VacancySectionsTable["Row"];
export type VacancySectionInsert = VacancySectionsTable["Insert"];
export type VacancySectionUpdate = VacancySectionsTable["Update"];

export type VacancyFieldRow = Omit<VacancyFieldsTable["Row"], "field_type"> & { field_type: VacancyFieldType };
export type VacancyFieldInsert = Omit<VacancyFieldsTable["Insert"], "field_type"> & { field_type?: VacancyFieldType };
export type VacancyFieldUpdate = Omit<VacancyFieldsTable["Update"], "field_type"> & { field_type?: VacancyFieldType };

export type VacancyAttachmentRow = Omit<VacancyAttachmentsTable["Row"], "type"> & { type: VacancyAttachmentType };
export type VacancyAttachmentInsert = Omit<VacancyAttachmentsTable["Insert"], "type"> & { type?: VacancyAttachmentType };
export type VacancyAttachmentUpdate = Omit<VacancyAttachmentsTable["Update"], "type"> & { type?: VacancyAttachmentType };

export type VacancyHistoryRow = Omit<VacancyHistoryTable["Row"], "entity_type" | "action"> & {
  entity_type: VacancyHistoryEntityType;
  action: VacancyHistoryAction;
};

/** Раздел вместе со своими полями и привязанными к нему вложениями — форма, в которой дерево живёт в редакторе. */
export interface VacancySectionWithChildren extends VacancySectionRow {
  fields: VacancyFieldRow[];
  attachments: VacancyAttachmentRow[];
}

/** Полное дерево одной вакансии — результат `getVacancyProjectTree`, черновик редактора строится из него же. */
export interface VacancyProjectTree {
  project: VacancyProjectListRow;
  sections: VacancySectionWithChildren[];
  /** Вложения с `section_id = null` — общий блок «Вложения» вакансии, не привязанный ни к одному разделу. */
  generalAttachments: VacancyAttachmentRow[];
}

/**
 * Форма payload'а для `portal_save_vacancy_project_tree` (см. миграцию
 * `20260805100600_vacancy_projects_rpc.sql`). `id: null` — новая строка,
 * `id` заполнен — существующая. Строка, чей `id` есть в дереве, но
 * отсутствует в присланном payload'е, удаляется на сервере (кроме
 * `is_system`-раздела — сервер отклонит попытку).
 */
export interface VacancyFieldDraft {
  id: string | null;
  label: string;
  value: string;
  field_type: VacancyFieldType;
  sort_order: number;
}

export interface VacancyAttachmentDraft {
  id: string | null;
  title: string;
  url: string;
  type: VacancyAttachmentType;
  sort_order: number;
}

export interface VacancySectionDraft {
  id: string | null;
  title: string;
  icon: string | null;
  is_system: boolean;
  sort_order: number;
  archived_at: string | null;
  fields: VacancyFieldDraft[];
  attachments: VacancyAttachmentDraft[];
}

export interface VacancyProjectTreeDraft {
  title: string;
  category_option_id: string | null;
  sections: VacancySectionDraft[];
  /** Общие вложения (`section_id = null`). */
  attachments: VacancyAttachmentDraft[];
}
