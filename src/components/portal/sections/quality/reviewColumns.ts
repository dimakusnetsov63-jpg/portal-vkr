/**
 * Состав колонок реестра проверок и его сохранение между сеансами.
 *
 * Команда КЦ попросила выбирать, какие атрибуты показывать, — как шестерёнка
 * в воронке Битрикса. Выбор без запоминания бессмысленен: сбрасывался бы на
 * каждой перезагрузке, и настраивать его никто не стал бы. Поэтому здесь
 * появляется первый в портале `localStorage` — ничего, кроме списка
 * идентификаторов колонок, в нём не лежит.
 *
 * Логика вынесена из компонента: разбор чужого содержимого хранилища —
 * ровно то место, где ошибка тихая. Испорченная или устаревшая запись не
 * должна оставлять человека с таблицей без единой колонки.
 */

export type ReviewColumnId =
  | "employee"
  | "reviewDate"
  | "lead"
  | "project"
  | "kind"
  | "total"
  | "violation"
  | "objection"
  | "recommendations"
  | "reviewer"
  | "case";

export interface ReviewColumnMeta {
  id: ReviewColumnId;
  label: string;
  /** Колонку нельзя спрятать: без неё строка перестаёт быть узнаваемой. */
  required?: boolean;
}

/** Порядок в этом списке — порядок колонок в таблице и в настройке. */
export const REVIEW_COLUMNS: ReviewColumnMeta[] = [
  { id: "employee", label: "Сотрудник", required: true },
  { id: "reviewDate", label: "Дата проверки" },
  { id: "lead", label: "Лид" },
  { id: "project", label: "Проект" },
  { id: "kind", label: "Вид" },
  { id: "total", label: "Итог" },
  { id: "violation", label: "Нарушение" },
  { id: "objection", label: "Возражение" },
  { id: "recommendations", label: "Комментарии и рекомендации" },
  { id: "reviewer", label: "Проверяющий" },
  { id: "case", label: "Кейс" },
];

const ALL_IDS = REVIEW_COLUMNS.map((column) => column.id);

/**
 * Что показывается, пока человек ничего не настроил.
 *
 * «Нарушение» спрятано: оно редкое, а причина обнулённого итога и так
 * подписана в самой ячейке итога. «Комментарии и рекомендации» показаны —
 * их и просили добавить.
 */
export const DEFAULT_COLUMNS: ReviewColumnId[] = ALL_IDS.filter((id) => id !== "violation");

export const COLUMNS_STORAGE_KEY = "vkr.quality.reviewColumns";

/**
 * Приводит сохранённый список к рабочему виду.
 *
 * Незнакомые идентификаторы отбрасываются (колонку могли переименовать или
 * убрать), обязательные добавляются обратно, порядок берётся из
 * `REVIEW_COLUMNS`, а не из хранилища: иначе перестановка колонок в коде не
 * доехала бы до тех, у кого настройка уже сохранена.
 *
 * Пустой или неразбираемый список означает «настройки нет» — возвращаются
 * умолчания. Показать таблицу вообще без колонок хуже, чем проигнорировать
 * испорченную запись.
 */
export function normalizeColumns(stored: unknown): ReviewColumnId[] {
  if (!Array.isArray(stored)) return DEFAULT_COLUMNS;

  const wanted = new Set(stored.filter((id): id is ReviewColumnId => ALL_IDS.includes(id as ReviewColumnId)));
  for (const column of REVIEW_COLUMNS) {
    if (column.required) wanted.add(column.id);
  }

  const visible = ALL_IDS.filter((id) => wanted.has(id));
  // Только обязательные — значит, человек спрятал всё, что мог, либо запись
  // испорчена. И то и другое лечится возвратом к умолчаниям.
  return visible.length <= REVIEW_COLUMNS.filter((column) => column.required).length
    ? DEFAULT_COLUMNS
    : visible;
}

/** Включает или выключает колонку. Обязательную выключить нельзя. */
export function toggleColumn(visible: ReviewColumnId[], id: ReviewColumnId): ReviewColumnId[] {
  const meta = REVIEW_COLUMNS.find((column) => column.id === id);
  if (!meta || meta.required) return visible;

  const next = visible.includes(id) ? visible.filter((item) => item !== id) : [...visible, id];
  return normalizeColumns(next);
}

/**
 * Чтение и запись настройки. Хранилище может быть недоступно — приватный
 * режим, отключённые куки, квота, — и раздел не должен из-за этого падать:
 * без сохранения он просто работает на умолчаниях.
 */
export function readStoredColumns(): ReviewColumnId[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    return normalizeColumns(raw === null ? null : JSON.parse(raw));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function writeStoredColumns(visible: ReviewColumnId[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visible));
  } catch {
    // Настройка не сохранится — таблица от этого работать не перестаёт.
  }
}
