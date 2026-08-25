"use client";

import styles from "./QualitySection.module.css";
import { formatPercent, scoreTone } from "./qualityOptions";
import { barWidth, weakestFirst, type ChartBar } from "./summaryChart";

/**
 * Горизонтальные столбцы сводки: блоки чек-листа, рейтинг сотрудников,
 * проекты, распределение. Форма у всех одна — подпись, дорожка, число, — и
 * заводить под каждый график свой компонент незачем.
 *
 * Нарисовано обычным CSS, без библиотеки графиков. В проекте четыре
 * зависимости, и тянуть ради полос ещё одну — с её весом в бандле и
 * обновлениями — несоразмерно задаче. Понадобятся линии с осями и
 * подсказками — решим отдельно.
 */
export function BlockBars({
  bars,
  caption,
  hint,
  showBaseline,
  order = "weakestFirst",
  tone = "score",
}: {
  bars: ChartBar[];
  caption: string;
  /** Оговорка под заголовком: чем именно график не является. */
  hint?: string;
  /** Засечка среднего для сравнения — только там, где есть с чем сравнивать. */
  showBaseline?: boolean;
  /** `keep` — порядок задан снаружи (рейтинг, диапазоны); менять его нельзя. */
  order?: "weakestFirst" | "keep";
  /**
   * `score` — цвет по порогам качества. `neutral` — для графиков, где полоса
   * означает долю, а не оценку: красная полоса «ниже 50%» читалась бы как
   * «этот диапазон плохой», хотя плохое здесь — его размер.
   */
  tone?: "score" | "neutral";
}) {
  const rows = order === "weakestFirst" ? weakestFirst(bars) : bars;

  if (rows.length === 0) return null;

  return (
    <section className={styles.chart}>
      <h4 className={styles.chartTitle}>{caption}</h4>
      {hint && <p className={styles.chartHint}>{hint}</p>}

      <div className={styles.chartRows}>
        {rows.map((bar) => (
          <div key={bar.label} className={styles.chartRow}>
            <span className={styles.chartLabel} title={bar.label}>
              {bar.label}
              {bar.note && <span className={styles.groupNote}>{bar.note}</span>}
            </span>

            <div className={styles.chartTrack}>
              <div
                className={`${styles.chartFill} ${tone === "score" ? (styles[`fill${toneClass(bar.value)}`] ?? "") : styles.fillNeutral}`}
                style={{ width: `${barWidth(bar.value)}%` }}
              />
              {/*
                Засечка базы рисуется поверх дорожки, а не рядом: «выше или
                ниже» читается положением, а не сличением двух чисел подряд.
              */}
              {showBaseline && bar.baseline !== null && (
                <div
                  className={styles.chartBaseline}
                  style={{ left: `${barWidth(bar.baseline)}%` }}
                  title={`Среднее по команде: ${formatPercent(bar.baseline)}`}
                />
              )}
            </div>

            <span className={styles.chartValue}>{formatPercent(bar.value)}</span>

            {showBaseline && (
              <span className={bar.delta !== null && bar.delta < 0 ? styles.chartDeltaDown : styles.chartDelta}>
                {bar.delta === null ? "" : `${bar.delta > 0 ? "+" : ""}${bar.delta}`}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Тон столбца — тот же, что у бейджа итога: пороги согласованы с бизнесом. */
function toneClass(value: number | null): string {
  const tone = scoreTone(value);
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}
