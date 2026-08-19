import type { QualityItemScale } from "@/lib/supabase/quality.types";

/**
 * Расчёт оценки проверки качества.
 *
 * Чистый модуль без React и Supabase. Нужен форме, чтобы показывать
 * проценты по мере проставления баллов: ждать ответа сервера на каждый клик
 * нельзя, а «оценка появляется только после сохранения» — ровно то, от чего
 * уходят из таблиц.
 *
 * ⚠️ Записанное значение приходит НЕ отсюда. Итог считает
 * `portal_save_quality_review` (миграция 20260818100400) — иначе процент
 * был бы полем ввода, которому клиент присылает любое число. Две
 * реализации одной формулы — осознанная цена превью; сверку на одинаковых
 * входах держит `qualityScore.test.ts`, а решение записано в
 * ADR-006.
 *
 * Формула повторяет исходный Excel:
 *   процент блока = сумма баллов / (2 × сумма весов зачтённых пунктов) × 100
 *   итог          = среднее по блокам с countsInTotal
 *
 * Отличия от Excel — все три сознательные и описаны в
 * `docs/requirements/quality.md`:
 *   * «не применимо» исключает пункт из знаменателя, а не считается нулём;
 *   * блок без зачтённых пунктов или с закрытым переключателем даёт `null`
 *     (в таблице на этом месте появлялся `#DIV/0!`);
 *   * ноль по критическому пункту обнуляет итог.
 */

export interface ScoreItem {
  id: string;
  scale: QualityItemScale;
  weight: number;
  isCritical: boolean;
}

export interface ScoreGroup {
  id: string;
  countsInTotal: boolean;
  items: ScoreItem[];
}

export interface ScoreAnswer {
  /** 0/1/2; у переключателя 1 = «Да», 0 = «Нет». `null` — пункт не заполнен. */
  value: number | null;
  isNa: boolean;
}

export type AnswerMap = Record<string, ScoreAnswer | undefined>;

export interface ReviewScore {
  /** Процент по каждому блоку; `null` — считать было не из чего. */
  groupScores: Record<string, number | null>;
  /** Итог; `null` — ни один блок не дал числа. */
  total: number | null;
  hasCritical: boolean;
}

/** Округление до сотых. Проценты неотрицательны, поэтому совпадает с `round(x, 2)` в Postgres. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Процент блока без округления — им же считается итог. Округляется только
 * то, что показывают и сохраняют: если усреднять уже округлённое, итог
 * разойдётся с Excel в третьем знаке на всей перенесённой истории.
 */
function rawGroupPercent(group: ScoreGroup, answers: AnswerMap): number | null {
  let earned = 0;
  let maximum = 0;

  for (const item of group.items) {
    const answer = answers[item.id];
    if (!answer) continue;

    // Переключатель баллов не даёт: «Нет» выключает блок целиком, «Да»
    // просто разрешает считать остальные пункты.
    if (item.scale === "yes_no") {
      if (answer.value === 0) return null;
      continue;
    }

    if (answer.isNa || answer.value === null) continue;

    earned += answer.value * item.weight;
    maximum += 2 * item.weight;
  }

  if (maximum === 0) return null;
  return (earned * 100) / maximum;
}

/** Процент блока в том виде, в каком он показывается и сохраняется. */
export function calculateGroupPercent(group: ScoreGroup, answers: AnswerMap): number | null {
  const raw = rawGroupPercent(group, answers);
  return raw === null ? null : round2(raw);
}

export function calculateReviewScore(groups: ScoreGroup[], answers: AnswerMap): ReviewScore {
  const groupScores: Record<string, number | null> = {};
  const counted: number[] = [];

  for (const group of groups) {
    const raw = rawGroupPercent(group, answers);
    groupScores[group.id] = raw === null ? null : round2(raw);
    if (raw !== null && group.countsInTotal) counted.push(raw);
  }

  const hasCritical = groups.some((group) =>
    group.items.some((item) => {
      const answer = answers[item.id];
      return item.isCritical && answer !== undefined && !answer.isNa && answer.value === 0;
    }),
  );

  if (hasCritical) {
    return { groupScores, total: 0, hasCritical: true };
  }

  const total = counted.length === 0 ? null : round2(counted.reduce((sum, value) => sum + value, 0) / counted.length);

  return { groupScores, total, hasCritical: false };
}

/**
 * Сколько пунктов блока осталось без ответа. Форма подсвечивает этим
 * незаполненное, а «не применимо» незаполненным не считает — это ответ.
 */
export function countUnanswered(group: ScoreGroup, answers: AnswerMap): number {
  const gate = group.items.find((item) => item.scale === "yes_no");
  if (gate && answers[gate.id]?.value === 0) return 0;

  return group.items.filter((item) => {
    const answer = answers[item.id];
    return !answer || (!answer.isNa && answer.value === null);
  }).length;
}

/**
 * Номер лида из того, что вставили в поле: и «3660718», и полная ссылка
 * вида `https://portal.sth-group.ru/crm/lead/details/3660718/`. В рабочих
 * таблицах лежит именно ссылка, и заставлять вручную выковыривать из неё
 * номер — способ получить опечатку.
 */
export function parseLeadId(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = /^\d+$/.exec(trimmed);
  if (direct) return Number(direct[0]);

  const fromUrl = /\/lead\/details\/(\d+)/.exec(trimmed);
  if (fromUrl) return Number(fromUrl[1]);

  // Последнее число в строке — запасной разбор для ссылок другого формата.
  const lastNumber = trimmed.match(/(\d{4,})/g);
  return lastNumber ? Number(lastNumber[lastNumber.length - 1]) : null;
}
