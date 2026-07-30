"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Icon } from "@/components/portal/ui/Icon";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { fmtDateTime, formatRelativeUpdatedAt } from "@/lib/portal/format";
import type { AddressRow } from "@/lib/supabase/addresses.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { OBJECT_TYPE_LABELS, priorityStars, STATUS_COLORS, STATUS_LABELS } from "./addressOptions";
import { addressDeficit } from "./addressMetrics";
import styles from "./AddressesSection.module.css";

export function AddressesTable({ rows, onRowClick }: { rows: AddressRow[]; onRowClick: (id: string) => void }) {
  const { archiveAddressRecord, restoreAddressRecord, duplicateAddressRecord } = usePortal();
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();

  return (
    <div className={styles.tableWrap}>
      <div className={`${styles.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colSticky} style={{ width: 260 }}>
                Адрес
              </th>
              <th>Проект</th>
              <th>Город</th>
              <th>Специализация</th>
              <th>Метро</th>
              <th>Район</th>
              <th>Тип объекта</th>
              <th>Требуется</th>
              <th>Есть</th>
              <th>Дефицит</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Координатор</th>
              <th>Обновлено</th>
              <th>Активен</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const deficit = addressDeficit(a);
              const isArchived = Boolean(a.archived_at);
              return (
                <tr key={a.id} onClick={() => onRowClick(a.id)}>
                  <td className={styles.colSticky}>
                    <div className={styles.nameCell}>{a.full_address}</div>
                  </td>
                  <td>{a.project}</td>
                  <td>{a.city}</td>
                  <td>{a.position || "—"}</td>
                  <td className={primitives.muted}>{a.metro || "—"}</td>
                  <td className={primitives.muted}>{a.district || "—"}</td>
                  <td>{OBJECT_TYPE_LABELS[a.object_type]}</td>
                  <td className={primitives.mono}>{a.required_count}</td>
                  <td className={primitives.mono}>{a.staffed_count}</td>
                  <td className={primitives.mono} style={{ color: deficit > 0 ? "var(--red)" : "var(--green)" }}>
                    {deficit}
                  </td>
                  <td>
                    <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                  </td>
                  <td title={String(a.priority)}>{priorityStars(a.priority)}</td>
                  <td className={primitives.muted}>{a.coordinator_name || "—"}</td>
                  <td className={primitives.muted} title={fmtDateTime(new Date(a.updated_at)) ?? undefined}>
                    {formatRelativeUpdatedAt(a.updated_at)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`${primitives.toggle} ${!isArchived ? primitives.toggleOn : ""}`}
                      onClick={() => (isArchived ? restoreAddressRecord(a.id) : archiveAddressRecord(a.id))}
                      aria-label={isArchived ? "Восстановить" : "Перевести в архив"}
                      title={isArchived ? "В архиве — нажмите, чтобы восстановить" : "Активен — нажмите, чтобы архивировать"}
                    />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.iconActionBtn}
                      onClick={() => duplicateAddressRecord(a.id)}
                      aria-label="Дублировать адрес"
                      title="Дублировать адрес"
                    >
                      <Icon name="file" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`${styles.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={styles.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
      <footer className={styles.pager}>
        <span>Всего: {rows.length}</span>
        <span>Прокрутите таблицу ползунком снизу →</span>
      </footer>
    </div>
  );
}
