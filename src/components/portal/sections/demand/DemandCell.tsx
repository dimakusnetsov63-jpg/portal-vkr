"use client";

import { useEffect, useRef, useState } from "react";
import { demandLevelForValue, isValidPlannedCount, type DemandCellLevel } from "./demandAggregate";
import styles from "./DemandSection.module.css";

const LEVEL_CLASS: Record<DemandCellLevel, string> = {
  empty: styles.lvlEmpty,
  zero: styles.lvlZero,
  normal: styles.lvlNormal,
  elevated: styles.lvlElevated,
  critical: styles.lvlCritical,
};

export function DemandCell({
  value,
  onSave,
}: {
  /** null = potребность не выставлена (no row). */
  value: number | null;
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

  async function commit() {
    const raw = draft.trim();
    setEditing(false);

    if (raw === "") {
      if (value === null) return;
      setPending(null);
      setSaving(true);
      await onSave(null);
      setSaving(false);
      setPending(undefined);
      return;
    }

    const parsed = Number(raw);
    if (!isValidPlannedCount(parsed) || parsed === value) return;

    setPending(parsed);
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
    setPending(undefined);
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
      className={`${styles.demandCell} ${LEVEL_CLASS[level]} ${saving ? styles.demandCellSaving : ""}`}
      onClick={startEdit}
      title={displayValue === null ? "Потребность не выставлена" : `Потребность: ${displayValue}`}
    >
      {displayValue === null ? "" : displayValue}
      {saving && <span className={styles.savingDot} />}
    </td>
  );
}
