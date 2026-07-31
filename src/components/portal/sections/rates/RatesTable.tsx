"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "@/components/portal/ui/Icon";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { fmtDateTime, fmtMoney, formatRelativeUpdatedAt } from "@/lib/portal/format";
import primitives from "@/components/portal/ui/primitives.module.css";
import { UNIT_LABELS } from "./rateOptions";
import { incomePerMonth, incomePerShift, incomePerWeek, type RateWithCard } from "./rateMetrics";
import type { RateUnit } from "@/lib/supabase/rates.types";
import styles from "./RatesSection.module.css";

function fmtMoneyOrDash(value: number | null): string {
  return value === null ? "—" : fmtMoney(Math.round(value));
}

export function RatesTable({ rows, onRowClick }: { rows: RateWithCard[]; onRowClick: (id: string) => void }) {
  const { deleteRateRecord } = usePortal();
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();

  return (
    <div className={primitives.tableWrap}>
      <div className={`${primitives.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={`${primitives.table} ${primitives.tableClickable} ${styles.table}`}>
          <thead>
            <tr>
              <th className={primitives.colSticky} style={{ width: 220 }}>
                Должность
              </th>
              <th>Проект</th>
              <th>Город</th>
              <th>Юр. лицо</th>
              <th>Ед. изм.</th>
              <th>За час</th>
              <th>Приоритет</th>
              <th>За смену</th>
              <th>За неделю</th>
              <th>За месяц</th>
              <th>Зарплатный проект</th>
              <th>Офис</th>
              <th>Обновлено</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rate, card }) => (
              <tr key={rate.id} onClick={() => onRowClick(rate.id)}>
                <td className={primitives.colSticky}>
                  <div className={primitives.nameCell}>{rate.position}</div>
                </td>
                <td>{card.project}</td>
                <td>{card.city}</td>
                <td className={primitives.muted}>{card.legal_entity || "—"}</td>
                <td className={primitives.muted}>{UNIT_LABELS[rate.unit as RateUnit]}</td>
                <td className={primitives.mono}>{rate.rate_hour === null ? "—" : fmtMoney(rate.rate_hour)}</td>
                <td className={primitives.mono}>
                  {rate.rate_hour_priority === null ? "—" : fmtMoney(rate.rate_hour_priority)}
                </td>
                <td className={primitives.mono}>{fmtMoneyOrDash(incomePerShift(rate))}</td>
                <td className={primitives.mono}>{fmtMoneyOrDash(incomePerWeek(rate))}</td>
                <td className={primitives.mono}>{fmtMoneyOrDash(incomePerMonth(rate))}</td>
                <td className={primitives.muted}>{card.payroll_banks.join(", ") || "—"}</td>
                <td className={primitives.muted}>{card.manager || "—"}</td>
                <td className={primitives.muted} title={fmtDateTime(new Date(rate.updated_at)) ?? undefined}>
                  {formatRelativeUpdatedAt(rate.updated_at)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`${primitives.btnIcon} ${primitives.btnIconSm} ${primitives.btnIconOutlined}`}
                    onClick={() => {
                      if (window.confirm(`Удалить ставку «${rate.position}»?`)) deleteRateRecord(rate.id);
                    }}
                    aria-label="Удалить ставку"
                    title="Удалить ставку"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${primitives.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={primitives.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
      <footer className={primitives.pager}>
        <span>Всего: {rows.length}</span>
        <span>Прокрутите таблицу ползунком снизу →</span>
      </footer>
    </div>
  );
}
