import type { AddressRow } from "@/lib/supabase/addresses.types";

/**
 * Дефицит и укомплектованность — НЕ хранятся в БД, всегда считаются здесь из
 * `required_count`/`staffed_count` (см. миграцию и requirements/addresses.md,
 * «Архитектурные дополнения» ТЗ). При отсутствии потребности (`required_count
 * === 0`) укомплектованность — явно `100%`, а не `0%`: это осознанное
 * отличие от общего правила «пусто/0 → 0%», так задано для этого раздела.
 */
export function addressDeficit(row: AddressRow): number {
  return row.required_count - row.staffed_count;
}

export function addressFillRate(row: AddressRow): number {
  if (row.required_count === 0) return 100;
  return (row.staffed_count / row.required_count) * 100;
}

/**
 * Карточка «сейчас в работе»: по ней действительно кого-то ищут. Импорт не
 * удаляет и не архивирует объект, пропавший из выгрузки, — он ставит
 * `required_count = 0` (объект вернётся в следующем файле вместе со всем,
 * что координатор заполнил руками). Поэтому в базе копятся карточки с нулём
 * — следы прошлых выгрузок, — и без этого признака дашборд считал бы их
 * наравне с живыми.
 */
export function hasOpenDemand(row: AddressRow): boolean {
  return row.required_count > 0;
}

export interface AddressMetrics {
  /** Адресов, по которым сейчас есть потребность. */
  withDemand: number;
  active: number;
  archived: number;
}

/**
 * Pure metric computation. Обе выборки приходят уже **отфильтрованными** —
 * все восемь показателей отвечают на вопрос «что сейчас в выбранном срезе»,
 * будь то проект, город или должность:
 *  - `activeFilteredRows` — подходящие под фильтры и не в архиве;
 *  - `archivedFilteredRows` — подходящие под те же фильтры, но архивные.
 *
 * Два набора, а не один флаг, потому что переключатель «Активные/Архив»
 * в `filterAddresses` взаимоисключающий, а показатели от вкладки зависеть не
 * должны: открытый «Архив» не меняет ни одной цифры, обе выборки считаются
 * независимо от него.
 *
 * «Адресов с потребностью» считается по `hasOpenDemand`, а не по размеру
 * активной выборки: дашборд отвечает на вопрос «по скольким объектам сейчас
 * реально идёт набор», а обнулённая импортом карточка в этот ответ не входит,
 * хотя и остаётся активной.
 *
 * Пустая выборка даёт 0 по всем показателям, никогда NaN — та же конвенция,
 * что и в calculateCandidateMetrics.
 */
export function calculateAddressMetrics(
  activeFilteredRows: AddressRow[],
  archivedFilteredRows: AddressRow[],
): AddressMetrics {
  return {
    withDemand: activeFilteredRows.filter(hasOpenDemand).length,
    active: activeFilteredRows.length,
    archived: archivedFilteredRows.length,
  };
}
