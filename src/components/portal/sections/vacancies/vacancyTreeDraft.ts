import type {
  VacancyAttachmentDraft,
  VacancyAttachmentRow,
  VacancyFieldDraft,
  VacancyFieldRow,
  VacancyProjectTree,
  VacancyProjectTreeDraft,
  VacancySectionDraft,
  VacancySectionWithChildren,
} from "@/lib/supabase/vacancyProjects.types";

function toFieldDraft(field: VacancyFieldRow): VacancyFieldDraft {
  return {
    id: field.id,
    label: field.label,
    value: field.value,
    field_type: field.field_type,
    sort_order: field.sort_order,
  };
}

function toAttachmentDraft(attachment: VacancyAttachmentRow): VacancyAttachmentDraft {
  return {
    id: attachment.id,
    title: attachment.title,
    url: attachment.url,
    type: attachment.type,
    sort_order: attachment.sort_order,
  };
}

function toSectionDraft(section: VacancySectionWithChildren): VacancySectionDraft {
  return {
    id: section.id,
    title: section.title,
    icon: section.icon,
    is_system: section.is_system,
    sort_order: section.sort_order,
    archived_at: section.archived_at,
    fields: section.fields.map(toFieldDraft),
    attachments: section.attachments.map(toAttachmentDraft),
  };
}

/** Черновик редактора, построенный из загруженного дерева — точка отсчёта для «Редактировать»/«Отменить». */
export function buildDraftFromTree(tree: VacancyProjectTree): VacancyProjectTreeDraft {
  return {
    title: tree.project.title,
    category_option_id: tree.project.category_option_id,
    attachments: tree.generalAttachments.map(toAttachmentDraft),
    sections: tree.sections.map(toSectionDraft),
  };
}

/** Раздел без единого заполненного поля и без вложений — скрывается в режиме чтения (но виден при редактировании, чтобы было куда добавить первое поле). */
export function sectionHasVisibleContent(section: VacancySectionWithChildren): boolean {
  if (section.attachments.length > 0) return true;
  return section.fields.some((f) => f.value.trim() !== "");
}

function reorder<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next.map((item, i) => ({ ...item, sort_order: i }) as T);
}

export function reorderSections(draft: VacancyProjectTreeDraft, index: number, direction: "up" | "down"): VacancyProjectTreeDraft {
  return { ...draft, sections: reorder(draft.sections, index, direction) };
}

/** Совпадает ли раздел (по названию или любому полю) с поисковым запросом — для авто-разворачивания и подсветки при поиске внутри вакансии. */
export function sectionMatchesQuery(section: VacancySectionDraft, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (section.title.toLowerCase().includes(q)) return true;
  return section.fields.some((f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
}

export function reorderFields(
  draft: VacancyProjectTreeDraft,
  sectionIndex: number,
  fieldIndex: number,
  direction: "up" | "down",
): VacancyProjectTreeDraft {
  const sections = [...draft.sections];
  sections[sectionIndex] = { ...sections[sectionIndex], fields: reorder(sections[sectionIndex].fields, fieldIndex, direction) };
  return { ...draft, sections };
}
