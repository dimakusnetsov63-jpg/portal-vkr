import type { QualityGroupReportRow, QualityReportRow } from "@/lib/supabase/quality.types";

/**
 * Сводка по сотрудникам: одиннадцать метрик контроля качества, которые
 * команда просит на графиках.
 *
 * ЗАЧЕМ ЭТОТ МОДУЛЬ. Оба агрегата база отдаёт в удобном ей виде, а не в том,
 * в каком их читают. `portal_quality_report` даёт строку на пару «сотрудник ×
 * проект»; `portal_quality_report_by_group` — строку на пару «сотрудник ×
 * блок». Человеку нужна строка на сотрудника со всеми метриками сразу.
 *
 * ГЛАВНАЯ ТОНКОСТЬ — блоки группируются по названию, а не по `group_id`.
 * У каждого проекта свой шаблон (решение бизнеса 21 августа), и «Презентация
 * вакансии» у «Яндекс Лавки» и у «Бургер Кинга» — это два разных блока с
 * разными идентификаторами. По id они попали бы в сводку двумя колонками, и
 * сотрудник, работающий на двух проектах, оказался бы разорван пополам.
 * Название здесь — настоящий ключ смысла, id — технический.
 *
 * Цена этого решения названа прямо: переименуйте блок в одном шаблоне, и он
 * отделится от одноимённых в остальных. Такое видно сразу — в сводке
 * появится колонка-двойник.
 */

/** Средний процент по набору строк, взвешенный на число оценённых проверок. */
function weightedAverage(rows: { value: number | null; weight: number }[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const row of rows) {
    if (row.value === null || row.weight <= 0) continue;
    sum += row.value * row.weight;
    weight += row.weight;
  }
  return weight === 0 ? null : Math.round((sum / weight) * 100) / 100;
}

export interface EmployeeSummary {
  employee: string;
  /** Проверок за период — раздельно по видам: команда просила именно так. */
  callReviews: number;
  refusalReviews: number;
  /** Общий % качества по прослушкам КЦ. `null` — оценивать было нечего. */
  overall: number | null;
  cases: number;
  critical: number;
  /** Процент по блоку: ключ — название блока, а не идентификатор. */
  byBlock: Record<string, number | null>;
}

export interface SummaryInput {
  /** Строки `portal_quality_report` за период, по обоим видам проверки. */
  callReport: QualityReportRow[];
  refusalReport: QualityReportRow[];
  /** Строки `portal_quality_report_by_group` за период, по обоим видам. */
  groups: QualityGroupReportRow[];
}

/**
 * Складывает агрегаты в строку на сотрудника.
 *
 * Сотрудник попадает в сводку, если встретился хоть где-то: у человека может
 * не быть ни одной прослушки КЦ, но быть проверки самоотказов, и наоборот.
 * Пропустить такого значило бы потерять его из отчёта целиком.
 */
export function buildSummary(input: SummaryInput): EmployeeSummary[] {
  const byEmployee = new Map<string, EmployeeSummary>();
  const overallParts = new Map<string, { value: number | null; weight: number }[]>();
  const blockParts = new Map<string, Map<string, { value: number | null; weight: number }[]>>();

  function ensure(employee: string): EmployeeSummary {
    let row = byEmployee.get(employee);
    if (!row) {
      row = { employee, callReviews: 0, refusalReviews: 0, overall: null, cases: 0, critical: 0, byBlock: {} };
      byEmployee.set(employee, row);
      overallParts.set(employee, []);
      blockParts.set(employee, new Map());
    }
    return row;
  }

  for (const report of input.callReport) {
    const row = ensure(report.employee_name);
    row.callReviews += Number(report.reviews_count);
    row.cases += Number(report.cases_count);
    row.critical += Number(report.critical_count);
    // Средний итог взвешивается на `scored_count`, а не на `reviews_count`:
    // проверка без итога в среднее не входит вовсе — ни значением, ни весом
    // (BUG-03 аудита).
    overallParts
      .get(report.employee_name)!
      .push({ value: report.avg_total === null ? null : Number(report.avg_total), weight: Number(report.scored_count) });
  }

  for (const report of input.refusalReport) {
    const row = ensure(report.employee_name);
    row.refusalReviews += Number(report.reviews_count);
    row.cases += Number(report.cases_count);
    row.critical += Number(report.critical_count);
  }

  for (const group of input.groups) {
    ensure(group.employee_name);
    const blocks = blockParts.get(group.employee_name)!;
    const list = blocks.get(group.group_title) ?? [];
    list.push({
      value: group.avg_percent === null ? null : Number(group.avg_percent),
      weight: Number(group.scored_count),
    });
    blocks.set(group.group_title, list);
  }

  for (const [employee, row] of byEmployee) {
    row.overall = weightedAverage(overallParts.get(employee) ?? []);
    for (const [title, parts] of blockParts.get(employee) ?? []) {
      row.byBlock[title] = weightedAverage(parts);
    }
  }

  // Порядок — по фамилии: сводку читают глазами, ища конкретного человека.
  return [...byEmployee.values()].sort((a, b) => a.employee.localeCompare(b.employee, "ru"));
}

/**
 * Названия блоков в порядке показа.
 *
 * Собираются из самих данных, а не из зашитого списка: состав блоков задаёт
 * редактор шаблонов, и жёсткий перечень здесь означал бы, что новый блок в
 * сводку не попадёт, пока кто-нибудь не вспомнит про этот файл.
 *
 * Порядок — `group_sort_order` из шаблона. У разных шаблонов он может
 * расходиться, поэтому берётся наименьший: блок, стоящий в одном чек-листе
 * третьим, а в другом пятым, окажется третьим.
 */
export function blockColumns(groups: QualityGroupReportRow[]): { title: string; countsInTotal: boolean }[] {
  const order = new Map<string, { sort: number; countsInTotal: boolean }>();
  for (const group of groups) {
    const current = order.get(group.group_title);
    const sort = Number(group.group_sort_order);
    if (!current || sort < current.sort) {
      order.set(group.group_title, { sort, countsInTotal: group.counts_in_total });
    }
  }
  return [...order.entries()]
    .sort((a, b) => a[1].sort - b[1].sort || a[0].localeCompare(b[0], "ru"))
    .map(([title, meta]) => ({ title, countsInTotal: meta.countsInTotal }));
}

/** Итоговая строка «по всем сотрудникам» — та же арифметика, что и в строках. */
export function summaryTotals(rows: EmployeeSummary[], blocks: { title: string }[]): EmployeeSummary {
  const total: EmployeeSummary = {
    employee: "Все сотрудники",
    callReviews: 0,
    refusalReviews: 0,
    overall: null,
    cases: 0,
    critical: 0,
    byBlock: {},
  };

  for (const row of rows) {
    total.callReviews += row.callReviews;
    total.refusalReviews += row.refusalReviews;
    total.cases += row.cases;
    total.critical += row.critical;
  }

  // Вес — число проверок сотрудника, а не единица: иначе человек с двумя
  // прослушками влиял бы на общий процент так же, как человек с сорока.
  total.overall = weightedAverage(rows.map((row) => ({ value: row.overall, weight: row.callReviews })));
  for (const block of blocks) {
    total.byBlock[block.title] = weightedAverage(
      rows.map((row) => ({ value: row.byBlock[block.title] ?? null, weight: row.callReviews + row.refusalReviews })),
    );
  }

  return total;
}
