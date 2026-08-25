import type { EmployeeSummary } from "./qualitySummary";

/**
 * Подготовка данных для столбцов по блокам чек-листа.
 *
 * Отдельно от разметки, потому что здесь есть что проверять: сравнение
 * сотрудника со средним по команде и решение, когда сравнивать нельзя.
 * Ошибка тут не бросается в глаза — столбец просто окажется чуть не той
 * длины или подпишется «−3» там, где сравнивать было не с чем.
 */

export interface BlockBar {
  title: string;
  /** Блок «Возражения» показывается, но в общий процент не входит. */
  countsInTotal: boolean;
  /** Процент по блоку; `null` — не оценивалось, это не ноль. */
  value: number | null;
  /** Среднее по команде для сравнения; `null` — сравнивать не с чем. */
  baseline: number | null;
  /**
   * Насколько сотрудник выше или ниже команды. `null`, если хотя бы одна из
   * величин отсутствует: «−78» против пустоты — не отставание, а бессмыслица.
   */
  delta: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Столбцы для одного сотрудника рядом со средним по команде.
 *
 * `baseline` передаётся отдельно, а не берётся из строки: команда — это
 * итоговая строка сводки, посчитанная по тем же правилам взвешивания, и
 * пересчитывать её здесь заново значило бы завести вторую формулу.
 */
export function employeeBars(
  row: EmployeeSummary,
  team: EmployeeSummary | null,
  blocks: { title: string; countsInTotal: boolean }[],
): BlockBar[] {
  return blocks.map((block) => {
    const value = row.byBlock[block.title] ?? null;
    const baseline = team?.byBlock[block.title] ?? null;
    return {
      title: block.title,
      countsInTotal: block.countsInTotal,
      value,
      baseline,
      delta: value === null || baseline === null ? null : round2(value - baseline),
    };
  });
}

/** Столбцы по команде: те же блоки, но сравнивать не с чем — это и есть база. */
export function teamBars(team: EmployeeSummary, blocks: { title: string; countsInTotal: boolean }[]): BlockBar[] {
  return blocks.map((block) => ({
    title: block.title,
    countsInTotal: block.countsInTotal,
    value: team.byBlock[block.title] ?? null,
    baseline: null,
    delta: null,
  }));
}

/**
 * Блоки, где команда проседает сильнее всего, — сверху.
 *
 * Смысл графика не в том, чтобы перечислить блоки, а в том, чтобы показать,
 * чему учить в первую очередь. Блоки без оценки уходят в конец: их не на чем
 * ранжировать, но и прятать нельзя — пустой блок сам по себе новость.
 */
export function weakestFirst(bars: BlockBar[]): BlockBar[] {
  return [...bars].sort((a, b) => {
    if (a.value === null && b.value === null) return a.title.localeCompare(b.title, "ru");
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return a.value - b.value;
  });
}

/**
 * Ширина столбца в процентах ширины дорожки.
 *
 * Проценты по блокам лежат в 0–100, но приходят из базы как `numeric` и
 * теоретически могут выйти за границы при правке формулы. Столбец шире
 * дорожки сломал бы вёрстку молча, поэтому значение зажимается здесь, а не
 * в разметке.
 */
export function barWidth(value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
