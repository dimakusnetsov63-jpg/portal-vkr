"use client";

import { useEffect, useRef, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import type { BadgeColor } from "@/lib/portal/types";
import { DEMAND_ROW_STATUSES, DEMAND_ROW_STATUS_LABELS, type DemandRowStatus } from "./demandRowMeta";
import styles from "./DemandSection.module.css";

const STATUS_COLOR: Record<DemandRowStatus, BadgeColor> = {
  active: "green",
  paused: "amber",
  closed: "gray",
};

/** Compact status Badge for a project+city row; click opens a small dropdown to change it. */
export function DemandRowStatusBadge({
  project,
  city,
  status,
}: {
  project: string;
  city: string;
  status: DemandRowStatus;
}) {
  const { updateDemandRowMeta } = usePortal();
  const [open, setOpen] = useState(false);
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

  async function choose(next: DemandRowStatus) {
    setOpen(false);
    if (next === status || saving) return;
    setSaving(true);
    await updateDemandRowMeta(project, city, { status: next });
    setSaving(false);
  }

  return (
    <div className={styles.rowStatusWrap} ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={styles.rowStatusTrigger}
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        aria-label="Изменить статус строки"
      >
        <Badge color={STATUS_COLOR[status]}>{DEMAND_ROW_STATUS_LABELS[status]}</Badge>
      </button>

      {open && (
        <div className={styles.rowStatusPanel}>
          {DEMAND_ROW_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.rowStatusOption} ${s === status ? styles.rowStatusOptionActive : ""}`}
              onClick={() => choose(s)}
            >
              {DEMAND_ROW_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
