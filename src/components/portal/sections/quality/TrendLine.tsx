"use client";

import { useId } from "react";
import styles from "./QualitySection.module.css";
import { formatPercent } from "./qualityOptions";
import { areaPath, smoothPath, type Point, type TrendSeries } from "./summaryChart";

/**
 * Линия среднего итога по месяцам.
 *
 * Inline SVG, без библиотеки графиков — по той же причине, что и столбцы:
 * ради двух кривых с подписями тянуть в проект пятую зависимость
 * несоразмерно.
 *
 * Ряды разнесены по видам проверки намеренно: складывать прослушку КЦ и
 * самоотказ в одну линию нельзя, у них разный смысл и разные шкалы.
 */

const WIDTH = 720;
const HEIGHT = 260;
/* Поля щедрые намеренно: линия, прижатая к рамке, читается как обрезанная. */
const PADDING = { top: 24, right: 24, bottom: 36, left: 48 };

/** Цвета рядов. Больше двух видов проверки в портале нет — список закрытый. */
const SERIES_COLOR: Record<string, string> = {
  call: "var(--accent)",
  refusal: "var(--amber)",
};

export function TrendLine({ series, caption, hint }: { series: TrendSeries[]; caption: string; hint?: string }) {
  // Идентификаторы градиентов уникальны на экземпляр: два графика на одной
  // странице делили бы одно определение, и второй утащил бы цвет первого.
  const gradientId = useId().replace(/:/g, "");

  const months = series[0]?.points ?? [];
  if (series.length === 0 || months.length === 0) return null;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baselineY = PADDING.top + plotHeight;

  /**
   * Шкала всегда от 0 до 100. Автоматический подбор границ по данным сделал
   * бы разницу в три пункта похожей на обвал — для процента качества, по
   * которому разговаривают с людьми, это недопустимое преувеличение.
   */
  const x = (index: number) =>
    PADDING.left + (months.length === 1 ? plotWidth / 2 : (index / (months.length - 1)) * plotWidth);
  const y = (value: number) => PADDING.top + plotHeight - (value / 100) * plotHeight;

  return (
    <section className={styles.chart}>
      <h4 className={styles.chartTitle}>{caption}</h4>
      {hint && <p className={styles.chartHint}>{hint}</p>}

      <div className={styles.trendLegend}>
        {series.map((row) => (
          <span key={row.kind} className={styles.trendLegendItem}>
            <i style={{ background: SERIES_COLOR[row.kind] ?? "var(--text-3)" }} />
            {row.label}
          </span>
        ))}
      </div>

      <svg className={styles.trendSvg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption}>
        <defs>
          {series.map((row) => (
            <linearGradient key={row.kind} id={`${gradientId}-${row.kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR[row.kind] ?? "var(--text-3)"} stopOpacity="0.22" />
              <stop offset="100%" stopColor={SERIES_COLOR[row.kind] ?? "var(--text-3)"} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(tick)} y2={y(tick)} className={styles.trendGrid} />
            <text x={PADDING.left - 10} y={y(tick) + 4} textAnchor="end" className={styles.trendTick}>
              {tick}
            </text>
          </g>
        ))}

        {months.map((point, index) => (
          <text key={point.month} x={x(index)} y={HEIGHT - 12} textAnchor="middle" className={styles.trendTick}>
            {point.label}
          </text>
        ))}

        {series.map((row) => {
          const color = SERIES_COLOR[row.kind] ?? "var(--text-3)";

          /*
            Пустые месяцы разрывают линию, а не соединяются кривой через них:
            соединив, мы нарисовали бы плавный переход там, где данных не
            было вовсе.
          */
          const segments: Point[][] = [];
          let current: Point[] = [];
          row.points.forEach((point, index) => {
            if (point.value === null) {
              if (current.length > 0) segments.push(current);
              current = [];
              return;
            }
            current.push({ x: x(index), y: y(point.value) });
          });
          if (current.length > 0) segments.push(current);

          return (
            <g key={row.kind}>
              {segments.map((segment, i) => (
                <path
                  key={`area-${i}`}
                  d={areaPath(segment, baselineY)}
                  fill={`url(#${gradientId}-${row.kind})`}
                  className={styles.trendArea}
                />
              ))}
              {segments.map((segment, i) => (
                <path
                  key={`line-${i}`}
                  d={smoothPath(segment)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.trendPath}
                />
              ))}
              {row.points.map((point, index) =>
                point.value === null ? null : (
                  <g key={point.month} className={styles.trendDot}>
                    {/* Ореол мерцает, сама точка стоит на месте: подвижная
                        точка на графике читается как меняющееся значение. */}
                    <circle cx={x(index)} cy={y(point.value)} r={9} fill={color} className={styles.trendHalo} />
                    <circle cx={x(index)} cy={y(point.value)} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={2.5}>
                      <title>{`${row.label}, ${point.label}: ${formatPercent(point.value)} (${point.reviews})`}</title>
                    </circle>
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>

      {/*
        Числа под графиком: линия показывает направление, а таблица —
        основание. Средний процент по трём проверкам и по двумстам выглядит
        на линии одинаково убедительно, и без числа проверок это вводит в
        заблуждение.
      */}
      <div className={styles.trendTable}>
        {series.map((row) => (
          <div key={row.kind} className={styles.trendTableRow}>
            <span className={styles.trendTableLabel}>{row.label}</span>
            {row.points.map((point) => (
              <span key={point.month} className={styles.trendTableCell}>
                <b>{formatPercent(point.value)}</b>
                <span>{point.reviews}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
