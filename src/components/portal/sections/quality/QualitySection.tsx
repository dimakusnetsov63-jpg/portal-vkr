"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { StatCard } from "@/components/portal/ui/StatCard";
import { EmptyState, ErrorState, SkeletonCards, SkeletonRows } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { listChecklists, listReviews, loadReport } from "@/lib/supabase/qualityRepo";
import type {
  QualityChecklistRow,
  QualityKind,
  QualityReportRow,
  QualityReviewFilters,
  QualityReviewRow,
  QualityReviewWithScores,
} from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { ReviewDrawer } from "./ReviewDrawer";
import { ReviewFormModal } from "./ReviewFormModal";
import { ReviewsTable } from "./ReviewsTable";
import { KIND_LABELS, QUALITY_KINDS, formatPercent } from "./qualityOptions";
import { summarizeReport } from "./qualityReport";

const PAGE_SIZE = 25;

type Tab = "reviews" | "cases";

/** Первое число месяца — период по умолчанию и для реестра, и для сводки. */
function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QualitySection() {
  const { listOptions, canEdit, setContextAction, pushToast } = usePortal();

  const [tab, setTab] = useState<Tab>("reviews");
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo, setDateTo] = useState(todayIso);
  const [project, setProject] = useState("");
  const [kind, setKind] = useState<QualityKind | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<QualityReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [report, setReport] = useState<QualityReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(true);

  const [checklists, setChecklists] = useState<QualityChecklistRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QualityReviewWithScores | null>(null);
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);

  const projectOptions = useMemo(
    () => activeListOptions(listOptions, "project").map((option) => option.value),
    [listOptions],
  );

  const filters = useMemo<QualityReviewFilters>(
    () => ({
      dateFrom,
      dateTo,
      project: project || undefined,
      kind: kind || undefined,
      search: search.trim() || undefined,
      onlyCases: tab === "cases" || undefined,
    }),
    [dateFrom, dateTo, project, kind, search, tab],
  );

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    listReviews(filters, PAGE_SIZE, page * PAGE_SIZE)
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
  }, [filters, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка и перезагрузка по фильтрам
    return reload();
  }, [reload]);

  // Сводка приходит отдельным агрегатом из базы, а не считается по
  // загруженной странице: показывать «средний итог по 25 строкам» и
  // называть это показателем месяца — способ ввести всех в заблуждение.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка агрегата за период
    setReportLoading(true);
    loadReport(dateFrom, dateTo, project || undefined, kind || undefined)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch(() => {
        if (!cancelled) setReport([]);
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, project, kind]);

  useEffect(() => {
    listChecklists()
      .then(setChecklists)
      .catch(() => pushToast("Не удалось загрузить шаблоны проверок", "error"));
  }, [pushToast]);

  const editable = canEdit("quality");

  useEffect(() => {
    if (!editable) return;
    setContextAction({
      label: "Новая проверка",
      onClick: () => {
        setEditing(null);
        setFormOpen(true);
      },
    });
    return () => setContextAction(null);
  }, [setContextAction, editable]);

  /**
   * Любая правка фильтра возвращает на первую страницу: иначе «страница 4»
   * на выборке из двух строк покажет пустоту без объяснений. Сброс живёт в
   * обработчиках, а не в эффекте на изменение фильтров — эффект здесь был бы
   * лишним прогоном рендера ради значения, которое известно в момент клика.
   */
  function onFirstPage<T>(setter: (value: T) => void): (value: T) => void {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  const stats = useMemo(() => summarizeReport(report), [report]);

  function resetFilters() {
    setPage(0);
    setDateFrom(startOfMonth());
    setDateTo(todayIso());
    setProject("");
    setKind("");
    setSearch("");
  }

  return (
    <>
      <PageHead eyebrow="Качество">
        Проверка звонков по чек-листам проектов и лидов, закрытых самоотказом: баллы, проценты по блокам и итог.
      </PageHead>

      {reportLoading ? (
        <SkeletonCards count={5} className={styles.statGrid} />
      ) : (
        <div className={styles.statGrid}>
          <StatCard icon="shield" value={stats.reviews} label="Проверок за период" />
          <StatCard icon="users" value={stats.employees} label="Сотрудников проверено" />
          <StatCard
            icon="bar"
            value={formatPercent(stats.average)}
            sublabel={stats.scored < stats.reviews ? `по ${stats.scored} из ${stats.reviews}` : undefined}
            label="Средний итог"
          />
          <StatCard icon="heart" value={stats.cases} label="Кейсов в аудиотеку" />
          <StatCard icon="alert" value={stats.critical} label="Критических ошибок" />
        </div>
      )}

      <Panel>
        <div className={primitives.pillTabs}>
          <button
            type="button"
            className={`${primitives.pillTabButton} ${tab === "reviews" ? primitives.pillTabButtonActive : ""}`}
            onClick={() => onFirstPage(setTab)("reviews")}
          >
            Проверки
          </button>
          <button
            type="button"
            className={`${primitives.pillTabButton} ${tab === "cases" ? primitives.pillTabButtonActive : ""}`}
            onClick={() => onFirstPage(setTab)("cases")}
          >
            Аудиотека
          </button>
        </div>

        <div className={primitives.toolbar}>
          <div className={primitives.searchField} style={{ minWidth: 240 }}>
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Номер лида или сотрудник"
              value={search}
              onChange={(event) => onFirstPage(setSearch)(event.target.value)}
            />
          </div>

          <input
            type="date"
            className={primitives.dateInput}
            value={dateFrom}
            onChange={(event) => onFirstPage(setDateFrom)(event.target.value)}
          />
          <input
            type="date"
            className={primitives.dateInput}
            value={dateTo}
            onChange={(event) => onFirstPage(setDateTo)(event.target.value)}
          />

          <select className={primitives.select} value={project} onChange={(event) => onFirstPage(setProject)(event.target.value)}>
            <option value="">Все проекты</option>
            {projectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={kind}
            onChange={(event) => onFirstPage(setKind)(event.target.value as QualityKind | "")}
          >
            <option value="">Все виды</option>
            {QUALITY_KINDS.map((option) => (
              <option key={option} value={option}>
                {KIND_LABELS[option]}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          {editable && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Icon name="plus" size={14} />
              Новая проверка
            </Button>
          )}
        </div>

        {loading && <SkeletonRows rows={9} />}
        {!loading && failed && <ErrorState onRetry={reload} />}
        {!loading &&
          !failed &&
          (rows.length === 0 ? (
            <EmptyState
              title={tab === "cases" ? "Кейсов пока нет" : "Проверок не найдено"}
              text={
                tab === "cases"
                  ? "Отметьте удачный звонок как кейс в карточке проверки — он появится здесь."
                  : "Измените период или фильтры, либо заведите первую проверку."
              }
              onReset={resetFilters}
            />
          ) : (
            <ReviewsTable
              rows={rows}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onRowClick={setOpenReviewId}
              onPageChange={setPage}
            />
          ))}
      </Panel>

      {formOpen && (
        <ReviewFormModal
          checklists={checklists}
          existing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={reload}
        />
      )}

      {openReviewId && (
        <ReviewDrawer
          reviewId={openReviewId}
          onClose={() => setOpenReviewId(null)}
          onEdit={(review) => {
            setEditing(review);
            setOpenReviewId(null);
            setFormOpen(true);
          }}
        />
      )}
    </>
  );
}
