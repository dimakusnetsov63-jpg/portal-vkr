"use client";

import { useEffect, useRef, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { currentWeekTargets, nextDayTarget, next7DaysTargets, untilDateTargets } from "./demandCopy";
import { DemandHistoryDrawer } from "./DemandHistoryDrawer";
import styles from "./DemandSection.module.css";

function pluralizeCells(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "ячеек";
  if (mod10 === 1) return "ячейку";
  if (mod10 >= 2 && mod10 <= 4) return "ячейки";
  return "ячеек";
}

/** Compact "…" actions menu for a filled demand cell — currently only copy actions (Этап 2A). */
export function DemandCellMenu({
  project,
  city,
  position,
  date,
  value,
}: {
  project: string;
  city: string;
  position: string;
  date: string;
  value: number;
}) {
  const { bulkSetDemandCells, pushToast } = usePortal();
  const [open, setOpen] = useState(false);
  const [untilDate, setUntilDate] = useState(date);
  const [confirm, setConfirm] = useState<{ label: string; targets: string[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function proposeCopy(label: string, targets: string[]) {
    setOpen(false);
    if (targets.length === 0) {
      pushToast("Нет дат для копирования", "error");
      return;
    }
    setConfirm({ label, targets });
  }

  async function handleConfirm() {
    if (!confirm) return;
    setSaving(true);
    const rows = confirm.targets.map((demand_date) => ({ project, city, position, demand_date, planned_count: value }));
    const ok = await bulkSetDemandCells(rows);
    setSaving(false);
    setConfirm(null);
    if (ok) pushToast("Потребность скопирована");
  }

  return (
    <div
      className={styles.cellMenuWrap}
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.cellMenuTrigger}
        aria-label="Действия с ячейкой"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="menu" size={11} />
      </button>

      {open && (
        <div className={styles.cellMenuPanel}>
          <button type="button" onClick={() => proposeCopy("на следующий день", nextDayTarget(date))}>
            Скопировать на следующий день
          </button>
          <button type="button" onClick={() => proposeCopy("на 7 дней", next7DaysTargets(date))}>
            Скопировать на 7 дней
          </button>
          <button type="button" onClick={() => proposeCopy("на всю неделю", currentWeekTargets(date))}>
            Скопировать на всю неделю
          </button>
          <div className={styles.cellMenuUntil}>
            <input
              type="date"
              min={date}
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
            />
            <button
              type="button"
              onClick={() => proposeCopy(`до ${untilDate}`, untilDateTargets(date, untilDate))}
            >
              До даты
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setHistoryOpen(true);
            }}
          >
            История изменений
          </button>
        </div>
      )}

      {historyOpen && (
        <DemandHistoryDrawer
          project={project}
          city={city}
          position={position}
          date={date}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title="Подтвердите копирование"
          footer={
            <>
              <Button onClick={() => setConfirm(null)}>Отмена</Button>
              <Button variant="primary" onClick={handleConfirm} disabled={saving}>
                {saving ? "Копирование…" : "Скопировать"}
              </Button>
            </>
          }
        >
          <p>
            Значение <strong>{value}</strong> будет скопировано {confirm.label} — затронуто{" "}
            <strong>{confirm.targets.length}</strong> {pluralizeCells(confirm.targets.length)}.
          </p>
        </Modal>
      )}
    </div>
  );
}
