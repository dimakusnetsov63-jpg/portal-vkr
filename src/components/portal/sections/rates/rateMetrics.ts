import type { RateCardRow, RateRow, RateSchedule } from "@/lib/supabase/rates.types";

/** Одна строка тарифа вместе со своим блоком условий — join выполняется здесь, на клиенте, один раз для всего раздела (без доп. запросов к БД — см. ratesRepo.ts). */
export interface RateWithCard {
  rate: RateRow;
  card: RateCardRow;
}

/**
 * Соединяет плоские списки `rates`/`rate_cards` по `rate.rate_card_id`.
 * Строка без своего блока в выдачу не попадает — при каскадном удалении
 * блока её просто не может существовать, а до первой синхронизации после
 * ошибки сети это единственный безопасный вариант, чем показывать тариф без
 * города/проекта.
 */
export function joinRatesWithCards(rates: RateRow[], cards: RateCardRow[]): RateWithCard[] {
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const result: RateWithCard[] = [];
  for (const rate of rates) {
    const card = cardsById.get(rate.rate_card_id);
    if (card) result.push({ rate, card });
  }
  return result;
}

/**
 * Смен в неделю по графику — усреднённая модель (не воспроизводит
 * конкретные множители исходной таблицы: там у каждого клиента свой ручной
 * коэффициент — 4, 6, 15 или 26 смен, — а не единая формула). `flexible` и
 * `parttime` не имеют регулярной кадансации — для них неделя/месяц не
 * считаются (см. incomePerWeek/incomePerMonth).
 */
export function shiftsPerWeek(schedule: RateSchedule | null): number | null {
  switch (schedule) {
    case "2/2":
    case "3/3":
      return 3.5;
    case "5/2":
      return 5;
    case "6/1":
      return 6;
    case "7/0":
      return 7;
    default:
      return null;
  }
}

const WEEKS_PER_MONTH = 365.25 / 12 / 7;

export function shiftsPerMonth(schedule: RateSchedule | null): number | null {
  const perWeek = shiftsPerWeek(schedule);
  return perWeek === null ? null : Math.round(perWeek * WEEKS_PER_MONTH);
}

/**
 * Доход за одну смену: почасовая ставка × часов в смене + сдельная часть +
 * фиксированная оплата за смену + средняя надбавка. Приоритетная почасовая
 * ставка (`rate_hour_priority`) в сумму не входит — это альтернативный
 * тариф для приоритетных смен, а не доплата поверх основного (иначе
 * значение задваивалось бы); интерфейс показывает её отдельной цифрой.
 */
export function incomePerShift(rate: RateRow): number {
  return (
    (rate.rate_hour ?? 0) * rate.shift_hours +
    (rate.rate_piece ?? 0) * (rate.pieces_per_shift ?? 0) +
    (rate.rate_shift ?? 0) +
    (rate.surcharge_per_shift ?? 0)
  );
}

/** `null`, если у графика нет регулярной кадансации (`flexible`/`parttime`) — «доход в неделю» здесь неопределён, а не 0. */
export function incomePerWeek(rate: RateRow): number | null {
  const shifts = shiftsPerWeek((rate.schedule as RateSchedule | null) ?? null);
  return shifts === null ? null : incomePerShift(rate) * shifts;
}

export function incomePerMonth(rate: RateRow): number | null {
  const shifts = shiftsPerMonth((rate.schedule as RateSchedule | null) ?? null);
  return shifts === null ? null : incomePerShift(rate) * shifts;
}

export interface RateMetrics {
  totalRates: number;
  totalCards: number;
  projectsCount: number;
  citiesCount: number;
  positionsCount: number;
  avgHourRate: number;
  avgShiftIncome: number;
  avgMonthIncome: number;
}

/**
 * Считается по уже отфильтрованной выборке (см. RatesSection), не по всем
 * данным — тот же принцип, что calculateAddressMetrics. Пустая выборка даёт
 * нули, никогда NaN: средние считаются только по строкам, где значение
 * определено (ставка за час задана / график задан), а не делением на
 * totalRates.
 */
export function calculateRateMetrics(rows: RateWithCard[]): RateMetrics {
  const totalRates = rows.length;
  const projects = new Set<string>();
  const cities = new Set<string>();
  const positions = new Set<string>();
  const cardIds = new Set<string>();

  let hourSum = 0;
  let hourCount = 0;
  let shiftSum = 0;
  let monthSum = 0;
  let monthCount = 0;

  for (const { rate, card } of rows) {
    projects.add(card.project);
    cities.add(card.city);
    positions.add(rate.position);
    cardIds.add(card.id);

    if (rate.rate_hour !== null) {
      hourSum += rate.rate_hour;
      hourCount += 1;
    }
    shiftSum += incomePerShift(rate);
    const month = incomePerMonth(rate);
    if (month !== null) {
      monthSum += month;
      monthCount += 1;
    }
  }

  return {
    totalRates,
    totalCards: cardIds.size,
    projectsCount: projects.size,
    citiesCount: cities.size,
    positionsCount: positions.size,
    avgHourRate: hourCount === 0 ? 0 : Math.round(hourSum / hourCount),
    avgShiftIncome: totalRates === 0 ? 0 : Math.round(shiftSum / totalRates),
    avgMonthIncome: monthCount === 0 ? 0 : Math.round(monthSum / monthCount),
  };
}
