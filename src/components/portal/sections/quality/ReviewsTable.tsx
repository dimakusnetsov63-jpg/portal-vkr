"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { DropdownPanel } from "@/components/portal/ui/Dropdown";
import { Icon } from "@/components/portal/ui/Icon";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { fmtDate } from "@/lib/portal/format";
import type { QualityReviewRow } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { KIND_LABELS, formatPercent, scoreTone } from "./qualityOptions";
import {
  REVIEW_COLUMNS,
  readStoredColumns,
  toggleColumn,
  writeStoredColumns,
  type ReviewColumnId,
} from "./reviewColumns";

/**
 * Реестр проверок. Пагинация серверная — в отличие от остальных таблиц
 * портала, которые фильтруют уже загруженный массив: за один месяц проверок
 * бывает под три тысячи (реальный июнь 2026), и «загрузить всё, потом
 * отфильтровать» здесь не работает.
 *
 * Состав колонок настраивается и запоминается — см. `reviewColumns.ts`.
 * Ширины заданы не всем: только там, где содержимое иначе растягивает
 * таблицу (имя, комментарий).
 */

const CELL: Record<ReviewColumnId, (review: QualityReviewRow) => ReactNode> = {
  employee: (review) => (
    <div className={primitives.nameCell}>
      {review.employee_name}
      {review.status === "draft" && <span className={styles.draftNote}>(черновик)</span>}
    </div>
  ),
  reviewDate: (review) => <span className={primitives.mono}>{fmtDate(new Date(review.review_date))}</span>,
  lead: (review) => <span className={`${primitives.mono} ${primitives.muted}`}>{review.crm_lead_id}</span>,
  project: (review) => review.project,
  kind: (review) => <span className={primitives.muted}>{KIND_LABELS[review.kind as "call" | "refusal"]}</span>,
  total: (review) => (
    <>
      <Badge color={scoreTone(review.total_score)}>{formatPercent(review.total_score)}</Badge>
      {/* Причина обнулённого итога подписана рядом: без неё ноль выглядит
          как провал по баллам, хотя баллы могли быть хорошими. */}
      {review.has_critical && <span className={styles.criticalNote}>критическая</span>}
      {review.violation && <span className={styles.criticalNote}>нарушение</span>}
    </>
  ),
  violation: (review) => <span className={primitives.muted}>{review.violation || "—"}</span>,
  objection: (review) => <span className={primitives.muted}>{review.objection || "—"}</span>,
  recommendations: (review) => <span className={styles.commentCell}>{review.recommendations || "—"}</span>,
  reviewer: (review) => <span className={primitives.muted}>{review.reviewer_name}</span>,
  case: (review) => (review.is_case ? "★" : "—"),
};

const COLUMN_WIDTH: Partial<Record<ReviewColumnId, number>> = {
  employee: 180,
  recommendations: 280,
};

export function ReviewsTable({
  rows,
  total,
  page,
  pageSize,
  onRowClick,
  onPageChange,
}: {
  rows: QualityReviewRow[];
  total: number;
  page: number;
  pageSize: number;
  onRowClick: (id: string) => void;
  onPageChange: (page: number) => void;
}) {
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, page * pageSize + rows.length);

  /**
   * Состав колонок читается из хранилища в эффекте, а не при инициализации:
   * первый рендер на сервере и первый рендер в браузере обязаны совпасть,
   * иначе React ругается на несовпадение разметки. До чтения показываются
   * умолчания — их же вернёт `readStoredColumns`, если ничего не сохранено.
   */
  const [visible, setVisible] = useState<ReviewColumnId[]>(() => readStoredColumns());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация с localStorage после гидратации
    setVisible(readStoredColumns());
  }, []);

  // Клик мимо панели закрывает её: без этого настройка остаётся раскрытой
  // поверх таблицы и мешает читать то, что настраивали.
  useEffect(() => {
    if (!settingsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [settingsOpen]);

  function onToggle(id: ReviewColumnId) {
    setVisible((prev) => {
      const next = toggleColumn(prev, id);
      writeStoredColumns(next);
      return next;
    });
  }

  const columns = REVIEW_COLUMNS.filter((column) => visible.includes(column.id));

  return (
    <div className={primitives.tableWrap}>
      <div className={styles.tableTools} ref={settingsRef}>
        <button
          type="button"
          className={primitives.btnIcon}
          aria-label="Настроить колонки"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Icon name="gear" size={16} />
        </button>
        {settingsOpen && (
          <DropdownPanel narrow>
            <div className={styles.columnPicker}>
              {REVIEW_COLUMNS.map((column) => (
                <label key={column.id} className={primitives.checkLabel}>
                  <input
                    type="checkbox"
                    checked={visible.includes(column.id)}
                    disabled={column.required}
                    onChange={() => onToggle(column.id)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </DropdownPanel>
        )}
      </div>

      <div className={`${primitives.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={`${primitives.table} ${primitives.tableClickable} ${styles.table}`}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={column.required ? primitives.colSticky : undefined}
                  style={COLUMN_WIDTH[column.id] ? { width: COLUMN_WIDTH[column.id] } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((review) => (
              <tr key={review.id} onClick={() => onRowClick(review.id)}>
                {columns.map((column) => (
                  <td key={column.id} className={column.required ? primitives.colSticky : undefined}>
                    {CELL[column.id](review)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${primitives.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={primitives.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
      <footer className={primitives.pager}>
        <span>
          {from}–{to} из {total}
        </span>
        <div className={styles.pagerButtons}>
          <Button size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            Назад
          </Button>
          <Button size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            Вперёд
          </Button>
        </div>
      </footer>
    </div>
  );
}
