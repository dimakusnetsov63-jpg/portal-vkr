"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // Portaled panel's on-screen position, computed from the trigger button
  // when opened. The panel is rendered straight to <body> — see the
  // comment below on why (same reason as ui/Modal.tsx).
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    // Scrolling (the matrix, or the page) would leave a `position: fixed`
    // panel visually detached from its trigger — simplest safe behaviour is
    // to just close it, same as an outside click.
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  }

  async function choose(next: DemandRowStatus) {
    setOpen(false);
    if (next === status || saving) return;
    setSaving(true);
    await updateDemandRowMeta(project, city, { status: next });
    setSaving(false);
  }

  return (
    <div className={styles.rowStatusWrap} onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.rowStatusTrigger}
        onClick={toggleOpen}
        disabled={saving}
        aria-label="Изменить статус строки"
      >
        <Badge color={STATUS_COLOR[status]}>{DEMAND_ROW_STATUS_LABELS[status]}</Badge>
      </button>

      {open &&
        panelPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className={styles.rowStatusPanel}
            style={{ position: "fixed", top: panelPos.top, left: panelPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
