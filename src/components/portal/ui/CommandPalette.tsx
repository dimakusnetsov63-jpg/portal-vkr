"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { Icon } from "./Icon";
import styles from "./CommandPalette.module.css";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { goto, candidates, openCandidateDrawer } = usePortal();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const q = query.trim().toLowerCase();

  const navMatches = useMemo(
    () => NAV_ITEMS.filter((item) => !q || item.label.toLowerCase().includes(q)),
    [q],
  );

  const candidateMatches = useMemo(() => {
    if (!q) return [];
    return candidates.filter((c) => c.fio.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)).slice(0, 6);
  }, [q, candidates]);

  const hasResults = navMatches.length > 0 || candidateMatches.length > 0;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.input}>
          <Icon name="grid" size={17} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Перейти в раздел или найти кандидата…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={styles.close} onClick={onClose} aria-label="Закрыть">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className={styles.list}>
          {!hasResults && <div className={styles.empty}>Ничего не найдено</div>}
          {navMatches.length > 0 && (
            <>
              <div className={styles.group}>Разделы</div>
              {navMatches.map((item) => (
                <button
                  key={item.id}
                  className={styles.item}
                  onClick={() => {
                    onClose();
                    goto(item.id);
                  }}
                >
                  <span className={styles.itemIco}>
                    <Icon name={item.icon} size={15} />
                  </span>
                  <b>{item.label}</b>
                </button>
              ))}
            </>
          )}
          {candidateMatches.length > 0 && (
            <>
              <div className={styles.group}>Кандидаты</div>
              {candidateMatches.map((c) => (
                <button
                  key={c.id}
                  className={styles.item}
                  onClick={() => {
                    onClose();
                    goto("candidates");
                    openCandidateDrawer(c.id);
                  }}
                >
                  <span className={styles.itemIco}>
                    <Icon name="users" size={15} />
                  </span>
                  <b>{c.fio}</b>
                  <span className={styles.itemMeta}>{c.id}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
