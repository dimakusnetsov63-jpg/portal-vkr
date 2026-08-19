import type { QualityReportRow } from "@/lib/supabase/quality.types";

/**
 * Свод строк отчёта в показатели над реестром.
 *
 * Вынесено из `QualitySection.tsx` не ради чистоты: расчёт жил внутри
 * `useMemo` и поэтому не покрывался ничем, а ошибка в нём (BUG-03 аудита)
 * тихо искажала цифру на главном экране раздела.
 *
 * Суть ошибки была в весе. `avg_total` считается базой **без** строк с
 * пустым итогом, а взвешивали его на `reviews_count`, который такие строки
 * включает. Пока итог есть у всех — сходится; одна проверка без итога — и
 * общий средний уезжает. Правильный вес — `scored_count`.
 *
 * Почему итог вообще бывает пустым: он равен `null`, когда считать было не
 * из чего — все пункты «не применимо» либо единственный блок выключен
 * переключателем. Ноль на этом месте означал бы «всё провалено», см.
 * ADR-006.
 */

export interface QualitySummary {
  /** Все завершённые проверки за период. */
  reviews: number;
  /** Сколько из них дали числовой итог — знаменатель среднего. */
  scored: number;
  /** Сотрудников, по которым есть хотя бы одна проверка. */
  employees: number;
  /** Средний итог по оценённым проверкам; `null` — оценивать нечего. */
  average: number | null;
  cases: number;
  critical: number;
}

/** Округление до сотых — как в `round(x, 2)` на стороне базы. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function summarizeReport(rows: QualityReportRow[]): QualitySummary {
  let reviews = 0;
  let scored = 0;
  let cases = 0;
  let critical = 0;
  let weighted = 0;

  const employees = new Set<string>();

  for (const row of rows) {
    const rowReviews = Number(row.reviews_count);
    const rowScored = Number(row.scored_count);

    reviews += rowReviews;
    scored += rowScored;
    cases += Number(row.cases_count);
    critical += Number(row.critical_count);
    employees.add(row.employee_name);

    // Строка без единого числового итога в среднее не входит вовсе — ни
    // значением, ни весом.
    if (row.avg_total !== null && rowScored > 0) {
      weighted += Number(row.avg_total) * rowScored;
    }
  }

  return {
    reviews,
    scored,
    employees: employees.size,
    average: scored === 0 ? null : round2(weighted / scored),
    cases,
    critical,
  };
}
