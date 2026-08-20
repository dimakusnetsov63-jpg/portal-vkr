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

/** Вкладка реестра. Не фильтр сам по себе — она задаёт сразу два признака. */
export type QualityTab = "reviews" | "cases" | "archived";

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
