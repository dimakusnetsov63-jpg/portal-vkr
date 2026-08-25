import type { QualityBucketRow, QualityMonthRow, QualityReportRow } from "@/lib/supabase/quality.types";
import type { EmployeeSummary } from "./qualitySummary";

/**
 * Подготовка данных для столбцов сводки.
 *
 * Отдельно от разметки, потому что здесь есть что проверять: взвешивание
 * средних, сравнение сотрудника с командой и решения о том, когда сравнивать
 * нельзя. Ошибка тут не бросается в глаза — столбец окажется чуть не той
 * длины или подпишется «−78» там, где сравнивать было не с чем.
 *
 * Все графики строятся из уже загруженных агрегатов: ни одного зашитого
 * числа, состав берётся из данных. Заведёте новый блок или проект — он
 * появится сам.
 */

export interface ChartBar {
  label: string;
  /** Процент; `null` — не оценивалось, это не ноль. */
  value: number | null;
  /** Что показать мелким шрифтом у подписи: число проверок, пометка блока. */
  note?: string;
  /** Среднее для сравнения; `null` — сравнивать не с чем. */
  baseline: number | null;
  /**
   * Насколько выше или ниже базы. `null`, если хотя бы одной величины нет:
   * «−78» против пустоты — не отставание, а бессмыслица.
   */
  delta: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function weighted(rows: { value: number | null; weight: number }[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const row of rows) {
    if (row.value === null || row.weight <= 0) continue;
    sum += row.value * row.weight;
    weight += row.weight;
  }
  return weight === 0 ? null : round2(sum / weight);
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// --- Блоки чек-листа -----------------------------------------------------

/**
 * Столбцы для одного сотрудника рядом со средним по команде.
 *
 * `team` передаётся отдельно, а не пересчитывается здесь: команда — это
 * итоговая строка сводки, посчитанная по тем же правилам взвешивания, и
 * второй расчёт означал бы вторую формулу.
 */
export function employeeBars(
  row: EmployeeSummary,
  team: EmployeeSummary | null,
  blocks: { title: string; countsInTotal: boolean }[],
): ChartBar[] {
  return blocks.map((block) => {
    const value = row.byBlock[block.title] ?? null;
    const baseline = team?.byBlock[block.title] ?? null;
    return {
      label: block.title,
      note: block.countsInTotal ? undefined : "не в итог",
      value,
      baseline,
      delta: value === null || baseline === null ? null : round2(value - baseline),
    };
  });
}

/** Столбцы по команде: сравнивать не с чем — она сама база. */
export function teamBars(team: EmployeeSummary, blocks: { title: string; countsInTotal: boolean }[]): ChartBar[] {
  return blocks.map((block) => ({
    label: block.title,
    note: block.countsInTotal ? undefined : "не в итог",
    value: team.byBlock[block.title] ?? null,
    baseline: null,
    delta: null,
  }));
}

// --- Рейтинг сотрудников -------------------------------------------------

/**
 * Сотрудники по общему проценту, сильные сверху.
 *
 * Рядом с процентом обязательно стоит число проверок. Без него график
 * превращается в доску позора, где 100% по двум прослушкам выглядят
 * убедительнее 85% по сорока — а это ровно наоборот.
 *
 * Сотрудники без единой прослушки КЦ не попадают: общий процент считается
 * по ним, и пустая полоса в рейтинге ничего не сообщает.
 */
export function employeeRanking(rows: EmployeeSummary[], team: EmployeeSummary | null): ChartBar[] {
  return rows
    .filter((row) => row.callReviews > 0)
    .map((row) => ({
      label: row.employee,
      note: plural(row.callReviews, "проверка", "проверки", "проверок"),
      value: row.overall,
      baseline: team?.overall ?? null,
      delta: row.overall === null || !team?.overall ? null : round2(row.overall - team.overall),
    }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}

// --- Проекты -------------------------------------------------------------

/**
 * Проекты по общему проценту.
 *
 * Сравнение между проектами честно лишь отчасти: с 21 августа у каждого свой
 * чек-лист, и проценты считаются по разным наборам критериев. Оговорка стоит
 * прямо на экране — цифры сопоставимы внутри проекта, а между проектами это
 * скорее ориентир, чем приговор.
 */
export function projectBars(callReport: QualityReportRow[]): ChartBar[] {
  const byProject = new Map<string, { parts: { value: number | null; weight: number }[]; reviews: number }>();

  for (const row of callReport) {
    const entry = byProject.get(row.project) ?? { parts: [], reviews: 0 };
    entry.parts.push({
      value: row.avg_total === null ? null : Number(row.avg_total),
      weight: Number(row.scored_count),
    });
    entry.reviews += Number(row.reviews_count);
    byProject.set(row.project, entry);
  }

  return [...byProject.entries()]
    .map(([project, entry]) => ({
      label: project,
      note: plural(entry.reviews, "проверка", "проверки", "проверок"),
      value: weighted(entry.parts),
      baseline: null,
      delta: null,
    }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}

// --- Общее ---------------------------------------------------------------

/**
 * Слабое сверху — для графиков, где смысл в «чему учить».
 *
 * Блоки без оценки уходят в конец: их не на чем ранжировать, но и прятать
 * нельзя — неоценённый блок сам по себе новость.
 */
export function weakestFirst(bars: ChartBar[]): ChartBar[] {
  return [...bars].sort((a, b) => {
    if (a.value === null && b.value === null) return a.label.localeCompare(b.label, "ru");
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return a.value - b.value;
  });
}

/**
 * Ширина столбца в процентах ширины дорожки.
 *
 * Проценты приходят из базы как `numeric` и теоретически могут выйти за
 * границы при правке формулы. Столбец шире дорожки сломал бы вёрстку молча,
 * поэтому значение зажимается здесь, а не в разметке.
 */
export function barWidth(value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

// --- Динамика по месяцам -------------------------------------------------

export interface TrendPoint {
  /** Первое число месяца из базы — ключ и основа подписи. */
  month: string;
  label: string;
  value: number | null;
  reviews: number;
}

export interface TrendSeries {
  kind: string;
  label: string;
  points: TrendPoint[];
}

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «2026-06-01» → «июн 26». Разбор из частей строки, а не через `Date`. */
function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year.slice(2)}`;
}

/**
 * Помесячные ряды — по одному на вид проверки.
 *
 * Виды не складываются: у прослушки КЦ и самоотказа разный смысл и разные
 * шкалы, и общая линия по ним не значила бы ничего. В данных это видно
 * сразу — у звонков средний около 83%, у самоотказов около 56%, и их
 * полусумма не описывает ни то ни другое.
 *
 * Месяцы выравниваются по всем рядам: если в мае самоотказов не было, точка
 * всё равно есть, но пустая. Иначе линии разъехались бы по горизонтали и
 * сравнивать их стало бы нельзя.
 */
export function trendSeries(rows: QualityMonthRow[], labels: Record<string, string>): TrendSeries[] {
  const months = [...new Set(rows.map((row) => row.month))].sort();
  const kinds = [...new Set(rows.map((row) => row.kind))].sort();

  return kinds.map((kind) => ({
    kind,
    label: labels[kind] ?? kind,
    points: months.map((month) => {
      const row = rows.find((item) => item.month === month && item.kind === kind);
      return {
        month,
        label: monthLabel(month),
        value: row?.avg_total === null || row?.avg_total === undefined ? null : Number(row.avg_total),
        reviews: row ? Number(row.reviews_count) : 0,
      };
    }),
  }));
}

/**
 * Столбцы распределения из серверного агрегата.
 *
 * Длина полосы — доля от числа проверок, а не процент качества: иначе полосы
 * были бы несопоставимы с остальными графиками, где длина означает оценку.
 * Порядок задаёт база (`bucket_order`) — пересортировывать нельзя, диапазоны
 * идут сверху вниз от лучшего к худшему.
 */
export function distributionBars(rows: QualityBucketRow[]): ChartBar[] {
  const total = rows.reduce((sum, row) => sum + Number(row.reviews_count), 0);
  if (total === 0) return [];

  return [...rows]
    .sort((a, b) => Number(a.bucket_order) - Number(b.bucket_order))
    .map((row) => {
      const count = Number(row.reviews_count);
      return {
        label: row.bucket,
        note: plural(count, "проверка", "проверки", "проверок"),
        value: round2((count / total) * 100),
        baseline: null,
        delta: null,
      };
    });
}
