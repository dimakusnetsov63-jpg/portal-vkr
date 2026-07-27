"use client";

import { useEffect, useRef, useState } from "react";
import { demandLevelForValue, type DemandCellLevel } from "./demandAggregate";
import { resolveCellCommit } from "./demandCellEdit";
import { DemandCellMenu } from "./DemandCellMenu";
import styles from "./DemandSection.module.css";

const LEVEL_CLASS: Record<DemandCellLevel, string> = {
  empty: styles.lvlEmpty,
  zero: styles.lvlZero,
  normal: styles.lvlNormal,
  elevated: styles.lvlElevated,
  critical: styles.lvlCritical,
};

export function DemandCell({
  project,
  city,
  position,
  date,
  value,
  isToday,
  onSave,
}: {
  project: string;
  city: string;
  position: string;
  date: string;
  /** null = potребность не выставлена (no row). */
  value: number | null;
  isToday?: boolean;
  onSave: (next: number | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<number | null | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against onBlur firing again after Escape already cancelled the edit
  // (the input unmounts on cancel, which can also dispatch a native blur).
  const skipBlurRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const displayValue = pending !== undefined ? pending : value;

  function startEdit() {
    setDraft(value === null ? "" : String(value));
    setEditing(true);
  }

  async function apply(raw: string) {
    const action = resolveCellCommit(raw, value);
    if (action.type === "noop") return;
    if (action.type === "delete") {
      setPending(null);
      setSaving(true);
      await onSave(null);
      setSaving(false);
      setPending(undefined);
      return;
    }
    setPending(action.value);
    setSaving(true);
    await onSave(action.value);
    setSaving(false);
    setPending(undefined);
  }

  async function commit() {
    const raw = draft;
    setEditing(false);
    await apply(raw);
  }

  function handleBlur() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    commit();
  }

  function cancel() {
    skipBlurRef.current = true;
    setEditing(false);
  }

  function handleViewKeyDown(e: React.KeyboardEvent<HTMLTableCellElement>) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (value !== null) apply("");
    } else if (e.key === "Enter") {
      startEdit();
    }
  }

  if (editing) {
    return (
      <td className={`${styles.demandCell} ${styles.demandCellEditing}`}>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={1}
          className={styles.cellInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
      </td>
    );
  }

  const level = demandLevelForValue(displayValue);

  return (
    <td
      className={`${styles.demandCell} ${LEVEL_CLASS[level]} ${saving ? styles.demandCellSaving : ""} ${isToday ? styles.demandCellToday : ""}`}
      onClick={startEdit}
      onKeyDown={handleViewKeyDown}
      tabIndex={0}
      title={displayValue === null ? "Потребность не выставлена" : `Потребность: ${displayValue}`}
    >
      {displayValue === null ? "" : displayValue}
      {saving && <span className={styles.savingDot} />}
      {displayValue !== null && !saving && (
        <DemandCellMenu project={project} city={city} position={position} date={date} value={displayValue} />
      )}
    </td>
  );
}
