"use client";

import styles from "./QualitySection.module.css";
import { formatPercent } from "./qualityOptions";
import type { TrendSeries } from "./summaryChart";

/**
 * Линия среднего итога по месяцам.
 *
 * Inline SVG, без библиотеки графиков — по той же причине, что и столбцы:
 * ради двух ломаных с подписями тянуть в проект пятую зависимость
 * несоразмерно. Здесь нет ни зума, ни подсказок при наведении на произвольную
 * точку — только то, что действительно нужно: как менялся процент и сколько
 * проверок за этим стоит.
 *
 * Ряды разнесены по видам проверки намеренно: складывать прослушку КЦ и
 * самоотказ в одну линию нельзя, у них разный смысл и разные шкалы.
 */

const WIDTH = 640;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };

/** Цвета рядов. Больше двух видов проверки в портале нет — список закрытый. */
const SERIES_COLOR: Record<string, string> = {
  call: "var(--accent)",
  refusal: "var(--amber)",
};

export function TrendLine({ series, caption, hint }: { series: TrendSeries[]; caption: string; hint?: string }) {
  const months = series[0]?.points ?? [];
  if (series.length === 0 || months.length === 0) return null;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

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

      <svg
        className={styles.trendSvg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={caption}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(tick)} y2={y(tick)} className={styles.trendGrid} />
            <text x={PADDING.left - 6} y={y(tick) + 4} textAnchor="end" className={styles.trendTick}>
              {tick}
            </text>
          </g>
        ))}

        {months.map((point, index) => (
          <text key={point.month} x={x(index)} y={HEIGHT - 8} textAnchor="middle" className={styles.trendTick}>
            {point.label}
          </text>
        ))}

        {series.map((row) => {
          const color = SERIES_COLOR[row.kind] ?? "var(--text-3)";
          /*
            Пустые месяцы разрывают линию, а не соединяются прямой через них:
            соединив, мы нарисовали бы плавный переход там, где данных не
            было вовсе.
          */
          const segments: string[] = [];
          let current: string[] = [];
          row.points.forEach((point, index) => {
            if (point.value === null) {
              if (current.length > 1) segments.push(current.join(" "));
              current = [];
              return;
            }
            current.push(`${current.length === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`);
          });
          if (current.length > 1) segments.push(current.join(" "));

          return (
            <g key={row.kind}>
              {segments.map((d) => (
                <path key={d} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              ))}
              {row.points.map((point, index) =>
                point.value === null ? null : (
                  <circle key={point.month} cx={x(index)} cy={y(point.value)} r={4} fill={color}>
                    <title>{`${row.label}, ${point.label}: ${formatPercent(point.value)} (${point.reviews})`}</title>
                  </circle>
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
