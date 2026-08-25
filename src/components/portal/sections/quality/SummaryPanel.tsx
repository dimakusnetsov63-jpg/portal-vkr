"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/portal/ui/Badge";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { loadReport, loadReportByGroup } from "@/lib/supabase/qualityRepo";
import type { QualityGroupReportRow, QualityReportRow } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { formatPercent, scoreTone } from "./qualityOptions";
import type { QualityFilterState } from "./qualityFilters";
import { blockColumns, buildSummary, summaryTotals } from "./qualitySummary";

/**
 * Сводка по сотрудникам за период — то, что в рабочих таблицах называлось
 * «Сводная по рекрутерам».
 *
 * Одиннадцать метрик, которые просила команда, складываются из двух
 * серверных агрегатов: общий процент из `portal_quality_report`, проценты по
 * блокам из `portal_quality_report_by_group`. Новых полей под них заводить не
 * пришлось — уточнение 21 августа показало, что каждая метрика это блок
 * целиком.
 *
 * Вся арифметика — в `qualitySummary.ts` и покрыта тестами. Здесь только
 * загрузка и разметка: складывать проценты «на глаз» в компоненте значило бы
 * повторить BUG-03, где средний взвешивали не на то поле и цифра на главном
 * экране тихо врала.
 */
export function SummaryPanel({ filters }: { filters: QualityFilterState }) {
  const [callReport, setCallReport] = useState<QualityReportRow[]>([]);
  const [refusalReport, setRefusalReport] = useState<QualityReportRow[]>([]);
  const [groups, setGroups] = useState<QualityGroupReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();

  const { dateFrom, dateTo, project, kind } = filters;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    const wanted = kind === "" ? undefined : kind;
    // Виды запрашиваются раздельно: команда просила видеть счётчик прослушек
    // КЦ и самоотказов по отдельности, а одним запросом их потом не
    // разделить — агрегат отдаёт сумму.
    Promise.all([
      wanted === "refusal" ? [] : loadReport(dateFrom, dateTo, project || undefined, "call"),
      wanted === "call" ? [] : loadReport(dateFrom, dateTo, project || undefined, "refusal"),
      loadReportByGroup(dateFrom, dateTo, project || undefined, wanted),
    ])
      .then(([call, refusal, byGroup]) => {
        if (cancelled) return;
        setCallReport(call);
        setRefusalReport(refusal);
        setGroups(byGroup);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, project, kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка агрегатов за период
    return load();
  }, [load]);

  const rows = useMemo(() => buildSummary({ callReport, refusalReport, groups }), [callReport, refusalReport, groups]);
  const blocks = useMemo(() => blockColumns(groups), [groups]);
  const totals = useMemo(() => summaryTotals(rows, blocks), [rows, blocks]);

  if (loading) return <SkeletonRows rows={8} />;
  if (failed) return <ErrorState onRetry={load} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="За период нет проверок"
        text="Измените период или фильтры — сводка строится по завершённым проверкам."
      />
    );
  }

  return (
    <div className={primitives.tableWrap}>
      <p className={styles.fieldNote} style={{ padding: "0 var(--sp-2) var(--sp-2)" }}>
        Считаются только завершённые проверки. Блоки сводятся по названию: одноимённый блок разных проектов — одна
        колонка. Блок «Возражения» в общий процент не входит — так было в рабочих таблицах.
      </p>

      <div className={`${primitives.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={`${primitives.table} ${styles.table}`}>
          <thead>
            <tr>
              <th className={primitives.colSticky} style={{ width: 200 }}>
                Сотрудник
              </th>
              <th>Прослушек КЦ</th>
              <th>Самоотказов</th>
              <th>Общий %</th>
              {blocks.map((block) => (
                <th key={block.title}>
                  {block.title}
                  {!block.countsInTotal && <span className={styles.groupNote}>не в итог</span>}
                </th>
              ))}
              <th>Кейсов</th>
              <th>Критических</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee}>
                <td className={primitives.colSticky}>
                  <div className={primitives.nameCell}>{row.employee}</div>
                </td>
                <td className={primitives.mono}>{row.callReviews || "—"}</td>
                <td className={primitives.mono}>{row.refusalReviews || "—"}</td>
                <td>
                  <Badge color={scoreTone(row.overall)}>{formatPercent(row.overall)}</Badge>
                </td>
                {blocks.map((block) => (
                  <td key={block.title} className={primitives.muted}>
                    {formatPercent(row.byBlock[block.title] ?? null)}
                  </td>
                ))}
                <td className={primitives.mono}>{row.cases || "—"}</td>
                <td className={primitives.mono}>{row.critical || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.summaryTotal}>
              <td className={primitives.colSticky}>
                <div className={primitives.nameCell}>{totals.employee}</div>
              </td>
              <td className={primitives.mono}>{totals.callReviews}</td>
              <td className={primitives.mono}>{totals.refusalReviews}</td>
              <td>
                <Badge color={scoreTone(totals.overall)}>{formatPercent(totals.overall)}</Badge>
              </td>
              {blocks.map((block) => (
                <td key={block.title}>{formatPercent(totals.byBlock[block.title] ?? null)}</td>
              ))}
              <td className={primitives.mono}>{totals.cases}</td>
              <td className={primitives.mono}>{totals.critical}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={`${primitives.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={primitives.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
    </div>
  );
}
