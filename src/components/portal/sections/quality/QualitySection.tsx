"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { StatCard } from "@/components/portal/ui/StatCard";
import { EmptyState, ErrorState, SkeletonCards, SkeletonRows } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { listChecklists } from "@/lib/supabase/qualityRepo";
import type { QualityChecklistRow, QualityKind, QualityReviewWithScores } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { ReviewDrawer } from "./ReviewDrawer";
import { ReviewFormModal } from "./ReviewFormModal";
import { ReviewsTable } from "./ReviewsTable";
import { ChecklistsPanel } from "./ChecklistsPanel";
import { SummaryPanel } from "./SummaryPanel";
import { KIND_LABELS, QUALITY_KINDS, formatPercent } from "./qualityOptions";
import { activePreset, PERIOD_PRESETS, type QualityTab } from "./qualityFilters";
import { useQualityReviews } from "./useQualityReviews";

/**
 * Раздел «Контроль качества» — оркестратор.
 *
 * Состояние реестра (фильтры, страница, загрузка списка и показателей)
 * живёт в `useQualityReviews`, здесь остаются композиция, разметка и
 * оверлеи. Разделение сделано под UX-этап: менять оформление раздела не
 * придётся вместе с логикой загрузки.
 */

const TABS: { id: QualityTab; label: string }[] = [
  { id: "reviews", label: "Проверки" },
  { id: "cases", label: "Аудиотека" },
  { id: "archived", label: "Архив" },
  { id: "summary", label: "Сводка" },
  { id: "checklists", label: "Шаблоны" },
];

// Пустое состояние есть у трёх вкладок реестра. У «Шаблонов» своё — оно
// живёт в ChecklistsPanel вместе с их загрузкой.
const EMPTY_STATE: Record<Exclude<QualityTab, "checklists" | "summary">, { title: string; text: string }> = {
  reviews: {
    title: "Проверок не найдено",
    text: "Измените период или фильтры, либо заведите первую проверку.",
  },
  cases: {
    title: "Кейсов пока нет",
    text: "Отметьте удачный звонок как кейс в карточке проверки — он появится здесь.",
  },
  archived: {
    title: "Архив пуст",
    text: "Сюда попадают проверки, убранные из работы: ошибочные, дубли, заведённые не на того сотрудника.",
  },
};

export function QualitySection() {
  const { listOptions, canEdit, setContextAction, pushToast } = usePortal();
  const registry = useQualityReviews();
  const { filters, setFilter, summary } = registry;

  const [checklists, setChecklists] = useState<QualityChecklistRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QualityReviewWithScores | null>(null);
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);

  const projectOptions = useMemo(
    () => activeListOptions(listOptions, "project").map((option) => option.value),
    [listOptions],
  );

  useEffect(() => {
    listChecklists()
      .then(setChecklists)
      .catch(() => pushToast("Не удалось загрузить шаблоны проверок", "error"));
  }, [pushToast]);

  const editable = canEdit("quality");

  function openNewReview() {
    setEditing(null);
    setFormOpen(true);
  }

  useEffect(() => {
    if (!editable) return;
    setContextAction({ label: "Новая проверка", onClick: openNewReview });
    return () => setContextAction(null);
  }, [setContextAction, editable]);

  // На вкладке шаблонов реестра нет вовсе, поэтому у неё нет ни пустого
  // состояния, ни фильтров, ни показателей: они все про проверки. «Сводка»
  // показывает те же проверки, свёрнутые по сотрудникам, — период, проект и
  // вид ей нужны, а поиск по лиду и постраничный реестр нет.
  const onChecklists = filters.tab === "checklists";
  const onSummary = filters.tab === "summary";
  const emptyState =
    filters.tab === "checklists" || filters.tab === "summary" ? null : EMPTY_STATE[filters.tab];
  const current = activePreset(filters);

  return (
    <>
      <PageHead eyebrow="Качество">
        Проверка звонков по чек-листам проектов и лидов, закрытых самоотказом: баллы, проценты по блокам и итог.
      </PageHead>

      {onChecklists ? null : registry.summaryLoading ? (
        <SkeletonCards count={5} className={styles.statGrid} />
      ) : (
        <div className={styles.statGrid}>
          <StatCard icon="shield" value={summary.reviews} label="Проверок за период" />
          <StatCard icon="users" value={summary.employees} label="Сотрудников проверено" />
          <StatCard
            icon="bar"
            value={formatPercent(summary.average)}
            sublabel={summary.scored < summary.reviews ? `по ${summary.scored} из ${summary.reviews}` : undefined}
            label="Средний итог"
          />
          <StatCard icon="heart" value={summary.cases} label="Кейсов в аудиотеку" />
          <StatCard icon="alert" value={summary.critical} label="Критических ошибок" />
        </div>
      )}

      <Panel>
        <div className={primitives.pillTabs}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${primitives.pillTabButton} ${filters.tab === item.id ? primitives.pillTabButtonActive : ""}`}
              onClick={() => setFilter("tab", item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {onChecklists && <ChecklistsPanel />}

        {!onChecklists && (
        <>
        {/*
          Готовые периоды — просьба команды КЦ: они пришли из воронки
          Битрикса и привыкли переключать период кнопкой, а не двумя
          календарями. Календари остались рядом: произвольный диапазон
          кнопками не выразить, и тогда ни одна из них не подсвечена.
        */}
        <div className={primitives.seg} style={{ marginBottom: "var(--sp-3)", width: "fit-content" }}>
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`${primitives.segButton} ${current === preset.id ? primitives.segButtonActive : ""}`}
              onClick={() => {
                const range = preset.range();
                registry.setPeriod(range.dateFrom, range.dateTo);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className={primitives.toolbar}>
          {!onSummary && (
          <div className={primitives.searchField} style={{ minWidth: 240 }}>
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Номер лида или сотрудник"
              value={filters.search}
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </div>
          )}

          <input
            type="date"
            className={primitives.dateInput}
            value={filters.dateFrom}
            onChange={(event) => setFilter("dateFrom", event.target.value)}
          />
          <input
            type="date"
            className={primitives.dateInput}
            value={filters.dateTo}
            onChange={(event) => setFilter("dateTo", event.target.value)}
          />

          <select
            className={primitives.select}
            value={filters.project}
            onChange={(event) => setFilter("project", event.target.value)}
          >
            <option value="">Все проекты</option>
            {projectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.kind}
            onChange={(event) => setFilter("kind", event.target.value as QualityKind | "")}
          >
            <option value="">Все виды</option>
            {QUALITY_KINDS.map((option) => (
              <option key={option} value={option}>
                {KIND_LABELS[option]}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={registry.resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          {editable && (
            <Button variant="primary" size="sm" onClick={openNewReview}>
              <Icon name="plus" size={14} />
              Новая проверка
            </Button>
          )}
        </div>

        {onSummary && <SummaryPanel filters={filters} />}

        {!onSummary && registry.loading && <SkeletonRows rows={9} />}
        {!onSummary && !registry.loading && registry.failed && <ErrorState onRetry={registry.reload} />}
        {!onSummary &&
          !registry.loading &&
          !registry.failed &&
          emptyState &&
          (registry.rows.length === 0 ? (
            <EmptyState title={emptyState.title} text={emptyState.text} onReset={registry.resetFilters} />
          ) : (
            <ReviewsTable
              rows={registry.rows}
              total={registry.total}
              page={registry.page}
              pageSize={registry.pageSize}
              onRowClick={setOpenReviewId}
              onPageChange={registry.setPage}
            />
          ))}
        </>
        )}
      </Panel>

      {formOpen && (
        <ReviewFormModal
          checklists={checklists}
          existing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={registry.reload}
        />
      )}

      {openReviewId && (
        <ReviewDrawer
          reviewId={openReviewId}
          onChanged={registry.reload}
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
