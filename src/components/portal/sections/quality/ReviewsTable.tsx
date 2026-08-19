"use client";

import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { fmtDate } from "@/lib/portal/format";
import type { QualityReviewRow } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { KIND_LABELS, formatPercent, scoreTone } from "./qualityOptions";

/**
 * Реестр проверок. Пагинация серверная — в отличие от остальных таблиц
 * портала, которые фильтруют уже загруженный массив: за один месяц проверок
 * бывает под три тысячи (реальный июнь 2026), и «загрузить всё, потом
 * отфильтровать» здесь не работает.
 */
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

  return (
    <div className={primitives.tableWrap}>
      <div className={`${primitives.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={`${primitives.table} ${primitives.tableClickable} ${styles.table}`}>
          <thead>
            <tr>
              <th className={primitives.colSticky} style={{ width: 180 }}>
                Сотрудник
              </th>
              <th>Дата проверки</th>
              <th>Лид</th>
              <th>Проект</th>
              <th>Вид</th>
              <th>Итог</th>
              <th>Возражение</th>
              <th>Проверяющий</th>
              <th>Кейс</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((review) => (
              <tr key={review.id} onClick={() => onRowClick(review.id)}>
                <td className={primitives.colSticky}>
                  <div className={primitives.nameCell}>
                    {review.employee_name}
                    {review.status === "draft" && <span className={styles.draftNote}>(черновик)</span>}
                  </div>
                </td>
                <td className={primitives.mono}>{fmtDate(new Date(review.review_date))}</td>
                <td className={`${primitives.mono} ${primitives.muted}`}>{review.crm_lead_id}</td>
                <td>{review.project}</td>
                <td className={primitives.muted}>{KIND_LABELS[review.kind as "call" | "refusal"]}</td>
                <td>
                  <Badge color={scoreTone(review.total_score)}>{formatPercent(review.total_score)}</Badge>
                  {review.has_critical && <span className={styles.criticalNote}>критическая</span>}
                </td>
                <td className={primitives.muted}>{review.objection || "—"}</td>
                <td className={primitives.muted}>{review.reviewer_name}</td>
                <td>{review.is_case ? "★" : "—"}</td>
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
