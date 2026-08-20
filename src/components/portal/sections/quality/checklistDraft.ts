import type { QualityChecklistTree, QualityItemScale, QualityKind } from "@/lib/supabase/quality.types";

/**
 * Черновик редактора шаблона: блоки и пункты в том виде, в каком их правят,
 * плюс операции над ним.
 *
 * Всё здесь чистое и без React. Причина не в опрятности: правка шаблона —
 * это перестановки, добавления и удаления во вложенном списке, где легко
 * незаметно порвать порядок или потерять `id` существующей строки. Потеря
 * `id` не выглядит ошибкой на экране: строка просто сохранится как новая, а
 * старая уйдёт в архив вместе со ссылками на неё из прошлых проверок.
 * Поэтому операции проверяются тестами, а не глазами.
 *
 * `id: null` означает «новая строка» — база вставит её и вернёт настоящий
 * идентификатор. Копия шаблона делается обнулением всех `id`.
 */

export interface ItemDraft {
  id: string | null;
  title: string;
  scale: QualityItemScale;
  weight: number;
  allowNa: boolean;
  isCritical: boolean;
}

export interface GroupDraft {
  id: string | null;
  title: string;
  countsInTotal: boolean;
  items: ItemDraft[];
}

export interface ChecklistDraft {
  title: string;
  kind: QualityKind;
  /** Пустая строка — общий шаблон, он же `project is null` в базе. */
  project: string;
  groups: GroupDraft[];
}

export function emptyItem(): ItemDraft {
  return { id: null, title: "", scale: "0-1-2", weight: 1, allowNa: true, isCritical: false };
}

export function emptyGroup(): GroupDraft {
  return { id: null, title: "", countsInTotal: true, items: [emptyItem()] };
}

export function emptyChecklist(kind: QualityKind = "call"): ChecklistDraft {
  return { title: "", kind, project: "", groups: [emptyGroup()] };
}

/**
 * Черновик из загруженного дерева. Архивные блоки и пункты в дерево не
 * приходят вовсе (`getChecklistTree` их не отдаёт), поэтому редактор их не
 * видит и не трогает: сохранение оставит их архивными, как есть.
 */
export function draftFromTree(tree: QualityChecklistTree): ChecklistDraft {
  return {
    title: tree.checklist.title,
    kind: tree.checklist.kind as QualityKind,
    project: tree.checklist.project ?? "",
    groups: tree.groups.map(({ group, items }) => ({
      id: group.id,
      title: group.title,
      countsInTotal: group.counts_in_total,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        scale: item.scale as QualityItemScale,
        weight: item.weight,
        allowNa: item.allow_na,
        isCritical: item.is_critical,
      })),
    })),
  };
}

/**
 * Копия шаблона: то же дерево, но все `id` обнулены — при сохранении
 * получится новый шаблон со своими строками.
 *
 * Ради этого редактор и стоит заводить: в чек-листе «Прослушки КЦ» тридцать
 * пять пунктов, и завести проектный вариант перепечатыванием никто не
 * станет.
 */
export function copyDraft(draft: ChecklistDraft, title: string): ChecklistDraft {
  return {
    ...draft,
    title,
    groups: draft.groups.map((group) => ({
      ...group,
      id: null,
      items: group.items.map((item) => ({ ...item, id: null })),
    })),
  };
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function moveGroup(draft: ChecklistDraft, index: number, direction: -1 | 1): ChecklistDraft {
  return { ...draft, groups: move(draft.groups, index, direction) };
}

export function moveItem(
  draft: ChecklistDraft,
  groupIndex: number,
  itemIndex: number,
  direction: -1 | 1,
): ChecklistDraft {
  const group = draft.groups[groupIndex];
  if (!group) return draft;
  const groups = [...draft.groups];
  groups[groupIndex] = { ...group, items: move(group.items, itemIndex, direction) };
  return { ...draft, groups };
}

export function updateGroup(draft: ChecklistDraft, index: number, patch: Partial<GroupDraft>): ChecklistDraft {
  const group = draft.groups[index];
  if (!group) return draft;
  const groups = [...draft.groups];
  groups[index] = { ...group, ...patch };
  return { ...draft, groups };
}

export function updateItem(
  draft: ChecklistDraft,
  groupIndex: number,
  itemIndex: number,
  patch: Partial<ItemDraft>,
): ChecklistDraft {
  const group = draft.groups[groupIndex];
  if (!group?.items[itemIndex]) return draft;
  const items = [...group.items];
  items[itemIndex] = { ...items[itemIndex], ...patch };
  const groups = [...draft.groups];
  groups[groupIndex] = { ...group, items };
  return { ...draft, groups };
}

export function addGroup(draft: ChecklistDraft): ChecklistDraft {
  return { ...draft, groups: [...draft.groups, emptyGroup()] };
}

export function removeGroup(draft: ChecklistDraft, index: number): ChecklistDraft {
  return { ...draft, groups: draft.groups.filter((_, i) => i !== index) };
}

export function addItem(draft: ChecklistDraft, groupIndex: number): ChecklistDraft {
  const group = draft.groups[groupIndex];
  if (!group) return draft;
  const groups = [...draft.groups];
  groups[groupIndex] = { ...group, items: [...group.items, emptyItem()] };
  return { ...draft, groups };
}

export function removeItem(draft: ChecklistDraft, groupIndex: number, itemIndex: number): ChecklistDraft {
  const group = draft.groups[groupIndex];
  if (!group) return draft;
  const groups = [...draft.groups];
  groups[groupIndex] = { ...group, items: group.items.filter((_, i) => i !== itemIndex) };
  return { ...draft, groups };
}

/**
 * Что не так с шаблоном. Пустой список — можно сохранять.
 *
 * Те же правила стоят в базе: она — место, где они действительно
 * соблюдаются, а здесь человек видит их до нажатия, а не в виде ошибки
 * после. Расхождение допустимо в одну сторону: интерфейс может запрещать
 * больше, но не меньше.
 */
export function validateChecklistDraft(draft: ChecklistDraft): string[] {
  const errors: string[] = [];

  if (draft.title.trim() === "") errors.push("Название шаблона обязательно.");
  if (draft.groups.length === 0) errors.push("В шаблоне должен быть хотя бы один блок.");

  draft.groups.forEach((group, groupIndex) => {
    const where = group.title.trim() || `блок ${groupIndex + 1}`;

    if (group.title.trim() === "") errors.push(`Название блока обязательно (${where}).`);
    if (group.items.length === 0) errors.push(`В блоке «${where}» нет ни одного пункта.`);

    // Переключатель управляет блоком целиком, поэтому второй в том же блоке
    // означал бы два взаимоисключающих выключателя у одного света.
    const gates = group.items.filter((item) => item.scale === "yes_no").length;
    if (gates > 1) errors.push(`В блоке «${where}» больше одного переключателя.`);

    group.items.forEach((item, itemIndex) => {
      if (item.title.trim() === "") errors.push(`Название пункта обязательно (${where}, пункт ${itemIndex + 1}).`);
      if (!Number.isInteger(item.weight) || item.weight < 1) {
        errors.push(`Вес пункта «${item.title.trim() || itemIndex + 1}» должен быть целым числом от единицы.`);
      }
    });

    const titles = group.items.map((item) => item.title.trim().toLowerCase()).filter(Boolean);
    if (new Set(titles).size !== titles.length) {
      errors.push(`В блоке «${where}» есть повторяющиеся пункты.`);
    }
  });

  // Хотя бы один блок должен идти в итог — иначе у проверки не будет итога
  // никогда, а раздел существует ради этой цифры.
  if (draft.groups.length > 0 && !draft.groups.some((group) => group.countsInTotal)) {
    errors.push("Хотя бы один блок должен входить в итог — иначе итог не посчитается.");
  }

  return errors;
}

/** Payload для `portal_save_quality_checklist_tree`. Порядок берётся из положения в списке. */
export function draftToPayload(draft: ChecklistDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    kind: draft.kind,
    project: draft.project || null,
    groups: draft.groups.map((group, groupIndex) => ({
      id: group.id,
      title: group.title.trim(),
      counts_in_total: group.countsInTotal,
      sort_order: groupIndex + 1,
      items: group.items.map((item, itemIndex) => ({
        id: item.id,
        title: item.title.trim(),
        scale: item.scale,
        weight: item.weight,
        // Переключатель «н/д» не принимает: он не оценка, а вопрос «было или
        // нет», и третьего состояния у него нет.
        allow_na: item.scale === "yes_no" ? false : item.allowNa,
        is_critical: item.isCritical,
        sort_order: itemIndex + 1,
      })),
    })),
  };
}
