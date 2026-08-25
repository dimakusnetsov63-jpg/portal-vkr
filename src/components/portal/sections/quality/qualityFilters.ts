import type { QualityKind, QualityReviewFilters } from "@/lib/supabase/quality.types";

/**
 * Состояние фильтров реестра и его перевод в запрос к базе.
 *
 * Вынесено из компонента отдельно от самого хука (C3 аудита): хук завязан
 * на React и потому не тестируется — в проекте нет ни jsdom, ни Testing
 * Library, и заводить их ради одного хука было бы отдельным решением. А вот
 * правила «какая вкладка что показывает» проверяются обычным unit-тестом и
 * ломаются тихо: перепутанный флаг превращает «Аудиотеку» в общий список, и
 * заметить это можно только глазами.
 */

/**
 * Вкладка раздела. Первые три — виды одной и той же выдачи проверок, они
 * задают признаки фильтра. «Сводка» показывает те же проверки, но свёрнутые
 * по сотрудникам, и период с проектом ей нужны. «Шаблоны» стоят особняком:
 * там не проверки, а их критерии, и фильтры реестра к ним неприменимы.
 */
export type QualityTab = "reviews" | "cases" | "archived" | "summary" | "checklists";

export interface QualityFilterState {
  tab: QualityTab;
  dateFrom: string;
  dateTo: string;
  project: string;
  kind: QualityKind | "";
  search: string;
}

/**
 * Дата в виде `YYYY-MM-DD` по **местному** времени.
 *
 * Не `toISOString().slice(0, 10)`: он переводит момент в UTC, и для
 * пользователя восточнее Гринвича местная полночь оказывается вчерашним
 * днём. На первом числе месяца это давало период, начинающийся 31-го
 * (BUG-07 аудита) — ошибка тихая: выборка просто чуть шире ожидаемой, а
 * ближе к полуночи «сегодня» превращается во «вчера».
 */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Первое число текущего месяца — период по умолчанию. */
export function startOfMonth(today = new Date()): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

export function todayIso(today = new Date()): string {
  return toIsoDate(today);
}

/**
 * Готовые периоды — как в воронке Битрикса, откуда команда и пришла.
 *
 * Считаются от переданной даты и только из местных компонентов: конструктор
 * `new Date(year, month, day)` сам разбирается с переходом через границу
 * месяца и года, поэтому «прошлый месяц» в январе даёт декабрь прошлого
 * года без отдельной ветки.
 */
export type PeriodPresetId = "week" | "month" | "prevMonth" | "quarter" | "year";

export interface PeriodPreset {
  id: PeriodPresetId;
  label: string;
  range: (today?: Date) => { dateFrom: string; dateTo: string };
}

/** Понедельник текущей недели: в России неделя начинается с него, а не с воскресенья. */
function startOfWeek(today: Date): Date {
  const shift = (today.getDay() + 6) % 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - shift);
}

export const PERIOD_PRESETS: PeriodPreset[] = [
  {
    id: "week",
    label: "Неделя",
    range: (today = new Date()) => ({ dateFrom: toIsoDate(startOfWeek(today)), dateTo: toIsoDate(today) }),
  },
  {
    id: "month",
    label: "Месяц",
    range: (today = new Date()) => ({ dateFrom: startOfMonth(today), dateTo: toIsoDate(today) }),
  },
  {
    id: "prevMonth",
    label: "Прошлый месяц",
    range: (today = new Date()) => ({
      dateFrom: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      // Нулевой день следующего месяца — последний день предыдущего, без
      // таблицы длин месяцев и без високосных лет.
      dateTo: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    }),
  },
  {
    id: "quarter",
    label: "Квартал",
    range: (today = new Date()) => ({
      dateFrom: toIsoDate(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)),
      dateTo: toIsoDate(today),
    }),
  },
  {
    id: "year",
    label: "Год",
    range: (today = new Date()) => ({
      dateFrom: toIsoDate(new Date(today.getFullYear(), 0, 1)),
      dateTo: toIsoDate(today),
    }),
  },
];

/**
 * Какой пресет соответствует текущему периоду. `null` — произвольный
 * диапазон, выставленный руками: подсвечивать в этом случае нечего.
 */
export function activePreset(state: QualityFilterState, today = new Date()): PeriodPresetId | null {
  for (const preset of PERIOD_PRESETS) {
    const range = preset.range(today);
    if (range.dateFrom === state.dateFrom && range.dateTo === state.dateTo) return preset.id;
  }
  return null;
}

export function defaultFilterState(): QualityFilterState {
  return {
    tab: "reviews",
    dateFrom: startOfMonth(),
    dateTo: todayIso(),
    project: "",
    kind: "",
    search: "",
  };
}

/**
 * Переводит состояние формы фильтров в запрос репозитория.
 *
 * Пустая строка означает «не фильтровать», поэтому превращается в
 * `undefined`, а не уезжает в запрос как пустое значение. Вкладка задаёт
 * два взаимоисключающих признака: «Аудиотека» — только отмеченные кейсы,
 * «Архив» — только убранные из работы.
 */
export function buildReviewFilters(state: QualityFilterState): QualityReviewFilters {
  return {
    dateFrom: state.dateFrom || undefined,
    dateTo: state.dateTo || undefined,
    project: state.project || undefined,
    kind: state.kind || undefined,
    search: state.search.trim() || undefined,
    onlyCases: state.tab === "cases" || undefined,
    showArchived: state.tab === "archived" || undefined,
  };
}
