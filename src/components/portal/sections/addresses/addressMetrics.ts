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
  /** Адресов, по которым сейчас есть потребность — из отфильтрованной выборки, в отличие от active/archived. */
  withDemand: number;
  active: number;
  archived: number;
  totalDemand: number;
  closedPositions: number;
  openDemand: number;
  criticalCount: number;
  avgFillRatePct: number;
}

/**
 * Pure metric computation. Two separate inputs on purpose:
 *  - `allRows` — the whole loaded dataset, used only for «Активных/Архивных
 *    адресов»: эти два счётчика про жизненный цикл карточки и не зависят ни
 *    от фильтров, ни от вкладки Активные/Архив;
 *  - `activeFilteredRows` — the currently-filtered set with archived
 *    addresses already excluded (regardless of which tab is open).
 *
 * Все показатели потребности считаются не по нему целиком, а по
 * **карточкам с ненулевой потребностью** (`hasOpenDemand`): дашборд отвечает
 * на вопрос «что нужно закрывать прямо сейчас», а обнулённый объект в этот
 * ответ не входит — ни своим приоритетом, ни своей укомплектованностью.
 * Особенно это важно для «Средней укомплектованности»: у карточки без
 * потребности `addressFillRate` даёт 100% (осознанное правило раздела), и
 * сотня-другая таких нулей раньше превращала показатель в долю обнулённых
 * карточек вместо реальной укомплектованности.
 *
 * Пустая выборка даёт 0 по всем показателям (никогда NaN, без деления на
 * ноль) — та же конвенция, что и в calculateCandidateMetrics.
 */
export function calculateAddressMetrics(allRows: AddressRow[], activeFilteredRows: AddressRow[]): AddressMetrics {
  const archived = allRows.filter((a) => Boolean(a.archived_at)).length;
  const active = allRows.length - archived;

  const demandRows = activeFilteredRows.filter(hasOpenDemand);

  let totalDemand = 0;
  let closedPositions = 0;
  let openDemand = 0;
  let criticalCount = 0;
  let fillRateSum = 0;

  for (const a of demandRows) {
    totalDemand += a.required_count;
    closedPositions += a.staffed_count;
    openDemand += Math.max(addressDeficit(a), 0);
    if (a.priority === 5) criticalCount += 1;
    fillRateSum += addressFillRate(a);
  }

  const avgFillRatePct = demandRows.length === 0 ? 0 : Math.round(fillRateSum / demandRows.length);

  return {
    withDemand: demandRows.length,
    active,
    archived,
    totalDemand,
    closedPositions,
    openDemand,
    criticalCount,
    avgFillRatePct,
  };
}
