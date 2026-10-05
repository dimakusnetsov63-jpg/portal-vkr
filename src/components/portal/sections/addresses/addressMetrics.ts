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
 * показатели отвечают на вопрос «что сейчас в выбранном срезе», будь то
 * проект, город или должность:
 *  - `inWorkRows` — вкладка «Активные»: не в архиве и с потребностью;
 *  - `outOfWorkRows` — вкладка «Архив»: архивные плюс обнулённые
 *    (см. `isOutOfWork` в addressFilters.ts).
 *
 * Два набора, а не один флаг, потому что вкладки в `filterAddresses`
 * взаимоисключающие, а показатели от открытой вкладки зависеть не должны.
 *
 * Карточки дашборда намеренно **не повторяют вкладки** один в один:
 * «Активных адресов» считает все неархивные, включая обнулённые, то есть
 * охватывает обе вкладки сразу. Поэтому каждый показатель выводится из
 * объединения наборов, а не из размера одного из них, — иначе «Активных»
 * совпало бы с «Адресов с потребностью» и карточка потеряла бы смысл.
 *
 * Пустая выборка даёт 0 по всем показателям, никогда NaN — та же конвенция,
 * что и в calculateCandidateMetrics.
 */
export function calculateAddressMetrics(inWorkRows: AddressRow[], outOfWorkRows: AddressRow[]): AddressMetrics {
  const all = [...inWorkRows, ...outOfWorkRows];
  return {
    withDemand: all.filter((a) => !a.archived_at && hasOpenDemand(a)).length,
    active: all.filter((a) => !a.archived_at).length,
    archived: all.filter((a) => Boolean(a.archived_at)).length,
  };
}
