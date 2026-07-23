"use client";

import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { stageColor } from "@/lib/portal/candidateOptions";
import { avatarColor, fmtDateTime, initials } from "@/lib/portal/format";
import type { Candidate } from "@/lib/supabase/candidates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./CandidatesSection.module.css";

export function CandidatesTable({
  rows,
  total,
  onRowClick,
  onLoadMore,
}: {
  rows: Candidate[];
  total: number;
  onRowClick: (id: string) => void;
  onLoadMore: () => void;
}) {
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();

  return (
    <div className={styles.tableWrap}>
      <div className={`${styles.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colSticky} style={{ width: 220 }}>
                ФИО
              </th>
              <th>Проект</th>
              <th>Город</th>
              <th>Стадия</th>
              <th>Рекрутер</th>
              <th>Менеджер</th>
              <th>Координатор</th>
              <th>External ID</th>
              <th>1-я смена</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => onRowClick(c.id)}>
                <td className={styles.colSticky}>
                  <div className={styles.nameCell}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        fontSize: 10,
                        borderRadius: "50%",
                        background: avatarColor(c.full_name),
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        flex: "none",
                      }}
                    >
                      {initials(c.full_name)}
                    </div>
                    {c.full_name}
                    {c.archived_at && (
                      <span className={primitives.muted} style={{ fontSize: 11 }}>
                        (вышел)
                      </span>
                    )}
                  </div>
                </td>
                <td>{c.project}</td>
                <td>{c.city || "—"}</td>
                <td>
                  <Badge color={stageColor(c.stage)}>{c.stage ?? "Не начал"}</Badge>
                </td>
                <td className={primitives.muted}>{c.recruiter || "—"}</td>
                <td className={primitives.muted}>{c.manager || "—"}</td>
                <td className={primitives.muted}>{c.coordinator || "—"}</td>
                <td className={`${primitives.mono} ${primitives.muted}`}>{c.external_id || "—"}</td>
                <td className={primitives.mono}>{c.first_shift_at ? fmtDateTime(new Date(c.first_shift_at)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${styles.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={styles.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
      <footer className={styles.pager}>
        <span>
          Показано {rows.length} из {total}
        </span>
        {rows.length < total ? (
          <Button size="sm" onClick={onLoadMore}>
            Показать ещё
          </Button>
        ) : (
          <span>Прокрутите таблицу ползунком снизу →</span>
        )}
      </footer>
    </div>
  );
}
