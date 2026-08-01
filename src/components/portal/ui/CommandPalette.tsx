"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { Icon } from "./Icon";
import modal from "./Modal.module.css";
import primitives from "./primitives.module.css";
import styles from "./CommandPalette.module.css";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { goto, realCandidates, openRealCandidateDrawer, can } = usePortal();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const q = query.trim().toLowerCase();

  // Закрытые для роли разделы в поиск не попадают — иначе палитра стала бы
  // обходным путём к разделам, которых нет в меню.
  const navMatches = useMemo(
    () => NAV_ITEMS.filter((item) => can(item.id) && (!q || item.label.toLowerCase().includes(q))),
    [q, can],
  );

  // Поиск идёт по реальному реестру. Роль без доступа к «Кандидатам» не
  // получает результатов вовсе — палитра не должна быть обходным путём к
  // данным, которых нет в меню (та же логика, что у navMatches выше).
  const canSeeCandidates = can("candidates");
  const candidateMatches = useMemo(() => {
    if (!q || !canSeeCandidates) return [];
    return realCandidates
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.external_id ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [q, canSeeCandidates, realCandidates]);

  const hasResults = navMatches.length > 0 || candidateMatches.length > 0;

  return (
    <div
      className={modal.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`${modal.modal} ${styles.paletteWidth}`} role="dialog" aria-modal="true">
        <div className={styles.input}>
          <Icon name="grid" size={16} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Перейти в раздел или найти кандидата…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={`${primitives.btnIcon} ${primitives.btnIconSm}`}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="x" size={16} />
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
                    <Icon name={item.icon} size={16} />
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
                    openRealCandidateDrawer(c.id);
                  }}
                >
                  <span className={styles.itemIco}>
                    <Icon name="users" size={16} />
                  </span>
                  <b>{c.full_name}</b>
                  <span className={styles.itemMeta}>
                    {/* Внутренний uuid пользователю ничего не говорит — показываем
                        бизнес-ID, а при его отсутствии город. Архив помечаем явно,
                        иначе выход по поиску на архивную карточку выглядит ошибкой. */}
                    {[c.external_id || c.city, c.archived_at ? "архив" : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
