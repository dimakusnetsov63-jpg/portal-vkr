"use client";

import styles from "./QualitySection.module.css";
import { formatPercent, scoreTone } from "./qualityOptions";
import { barWidth, weakestFirst, type BlockBar } from "./summaryChart";

/**
 * Столбцы по блокам чек-листа.
 *
 * Нарисованы обычным CSS, без библиотеки графиков. В проекте четыре
 * зависимости всего, и тянуть ради горизонтальных полос ещё одну — с её
 * весом в бандле и обновлениями — несоразмерно задаче. Понадобится что-то
 * вроде линий по месяцам с осями и подсказками — тогда и решим осознанно.
 *
 * Слабое сверху: смысл не в том, чтобы перечислить блоки, а в том, чтобы
 * показать, чему учить в первую очередь.
 */
export function BlockBars({
  bars,
  caption,
  showBaseline,
}: {
  bars: BlockBar[];
  caption: string;
  /** Показывать засечку среднего по команде — только в разрезе сотрудника. */
  showBaseline?: boolean;
}) {
  const sorted = weakestFirst(bars);

  return (
    <section className={styles.chart}>
      <h4 className={styles.chartTitle}>{caption}</h4>
      <div className={styles.chartRows}>
        {sorted.map((bar) => (
          <div key={bar.title} className={styles.chartRow}>
            <span className={styles.chartLabel} title={bar.title}>
              {bar.title}
              {!bar.countsInTotal && <span className={styles.groupNote}>не в итог</span>}
            </span>

            <div className={styles.chartTrack}>
              <div
                className={`${styles.chartFill} ${styles[`fill${toneClass(bar.value)}`] ?? ""}`}
                style={{ width: `${barWidth(bar.value)}%` }}
              />
              {/*
                Засечка среднего по команде. Она рисуется поверх дорожки, а
                не рядом: сравнение «выше или ниже» читается положением, а не
                чтением двух чисел подряд.
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
