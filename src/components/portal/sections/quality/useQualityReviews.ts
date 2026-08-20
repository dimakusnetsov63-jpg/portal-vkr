"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listReviews, loadReport } from "@/lib/supabase/qualityRepo";
import type { QualityReportRow, QualityReviewRow } from "@/lib/supabase/quality.types";
import {
  buildReviewFilters,
  defaultFilterState,
  startOfMonth,
  todayIso,
  type QualityFilterState,
} from "./qualityFilters";
import { summarizeReport, type QualitySummary } from "./qualityReport";

/**
 * Состояние реестра проверок: фильтры, страница, две загрузки.
 *
 * Вынесено из `QualitySection` (C3 аудита), чтобы компонент остался
 * композицией и разметкой. Это подготовка к UX-этапу: переделывать
 * оформление раздела не придётся вместе с логикой загрузки, а логику
 * загрузки — вместе с оформлением.
 *
 * Две загрузки живут здесь вместе не случайно: они читают один и тот же
 * период и фильтры, и рассинхронизация «список за одну дату, показатели за
 * другую» — ровно та ошибка, которую легко внести, разнеся их по разным
 * местам. Разное у них одно: страница реестра листается, а сводка считается
 * по всему периоду и от страницы не зависит.
 *
 * Тестами хук не покрыт: в проекте нет ни jsdom, ни Testing Library, и
 * заводить их ради одного хука — отдельное решение (см.
 * `docs/testing/strategy.md`). Поэтому всё, что можно решить без React,
 * вынесено рядом — в `qualityFilters.ts` и `qualityReport.ts`, и вот они
 * покрыты.
 */

const PAGE_SIZE = 25;

export interface QualityReviewsState {
  filters: QualityFilterState;
  /** Меняет одно поле фильтра и возвращает на первую страницу. */
  setFilter: <K extends keyof QualityFilterState>(key: K, value: QualityFilterState[K]) => void;
  /** Обе границы периода разом — для готовых периодов («Неделя», «Квартал», …). */
  setPeriod: (dateFrom: string, dateTo: string) => void;
  resetFilters: () => void;

  rows: QualityReviewRow[];
  total: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;

  loading: boolean;
  failed: boolean;
  /** Перечитать текущую страницу — после сохранения или архивации. */
  reload: () => void;

  summary: QualitySummary;
  summaryLoading: boolean;
}

export function useQualityReviews(): QualityReviewsState {
  const [filters, setFilters] = useState<QualityFilterState>(defaultFilterState);
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<QualityReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [report, setReport] = useState<QualityReportRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  /**
   * Любая правка фильтра возвращает на первую страницу: иначе «страница 4»
   * на выборке из двух строк покажет пустоту без объяснений. Сброс живёт
   * здесь, а не в эффекте на изменение фильтров — эффект был бы лишним
   * прогоном рендера ради значения, известного в момент вызова.
   */
  const setFilter = useCallback(
    <K extends keyof QualityFilterState>(key: K, value: QualityFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(0);
    },
    [],
  );

  /**
   * Обе границы периода разом. Через `setFilter` пришлось бы двумя вызовами,
   * и между ними существовало бы состояние «начало от нового периода, конец
   * от старого» — с ним уходил бы лишний запрос за заведомо неверной
   * выборкой.
   */
  const setPeriod = useCallback((dateFrom: string, dateTo: string) => {
    setFilters((prev) => ({ ...prev, dateFrom, dateTo }));
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilterState());
    setPage(0);
  }, []);

  const query = useMemo(() => buildReviewFilters(filters), [filters]);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    listReviews(query, PAGE_SIZE, page * PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
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
  }, [query, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка и перезагрузка по фильтрам
    return reload();
  }, [reload]);

  /**
   * Показатели приходят отдельным агрегатом из базы, а не считаются по
   * загруженной странице: «средний итог по 25 строкам» под подписью «за
   * период» вводил бы в заблуждение. От страницы не зависят — только от
   * периода и фильтров.
   */
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка агрегата за период
    setSummaryLoading(true);

    loadReport(filters.dateFrom, filters.dateTo, filters.project || undefined, filters.kind || undefined)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch(() => {
        if (!cancelled) setReport([]);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.dateFrom, filters.dateTo, filters.project, filters.kind]);

  const summary = useMemo(() => summarizeReport(report), [report]);

  return {
    filters,
    setFilter,
    setPeriod,
    resetFilters,
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    setPage,
    loading,
    failed,
    reload,
    summary,
    summaryLoading,
  };
}

export { startOfMonth, todayIso };
