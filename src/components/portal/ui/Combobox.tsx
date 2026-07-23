"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import styles from "./Combobox.module.css";

/**
 * Editable dropdown: shows a managed list of suggestions on click (with a
 * visible chevron, unlike a native <datalist>), while still allowing any
 * free-text value to be typed. Used for candidate fields whose column is
 * free text (recruiter/manager/coordinator/city) but whose suggestions are
 * curated in Settings.
 */
export function Combobox({
  value,
  onChange,
  options,
  id,
  placeholder,
  emptyHint = "Список пуст — добавьте значения в Настройках → Списки для кандидатов.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  id?: string;
  placeholder?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const query = value.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-label="Открыть список"
        tabIndex={-1}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
          <Icon name="chevron" size={14} />
        </span>
      </button>

      {open && (
        <div className={styles.panel}>
          {options.length === 0 ? (
            <div className={styles.hint}>{emptyHint}</div>
          ) : filtered.length === 0 ? (
            <div className={styles.hint}>Нет совпадений. Можно ввести своё значение.</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o}
                type="button"
                className={`${styles.option} ${o === value ? styles.optionActive : ""}`}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
