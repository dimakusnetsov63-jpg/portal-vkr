"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Accordion.module.css";

/** Вертикальный контейнер для нескольких AccordionItem — только отступы между карточками. */
export function Accordion({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}

/**
 * Одна раскрывающаяся карточка. Неконтролируемая по умолчанию (`defaultOpen`),
 * либо полностью контролируемая через `open`/`onToggle` — второе нужно,
 * например, чтобы якорное меню могло принудительно развернуть карточку.
 */
export function AccordionItem({
  id,
  title,
  icon,
  defaultOpen = false,
  open,
  onToggle,
  headerExtra,
  children,
}: {
  /** Проставляется на корневой элемент — используется для скролла из якорного меню (`scrollIntoView`). */
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** Кнопки действий в шапке (архивировать, ↑/↓ и т.п.) — клики по ним не переключают раскрытие. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;

  function toggle() {
    const next = !isOpen;
    if (onToggle) onToggle(next);
    else setUncontrolledOpen(next);
  }

  return (
    <div id={id} className={styles.item} data-open={isOpen || undefined}>
      <div className={styles.header}>
        <button type="button" className={styles.headerButton} aria-expanded={isOpen} onClick={toggle}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.title}>{title}</span>
          <span className={styles.chevron}>
            <Icon name="chevron" size={14} />
          </span>
        </button>
        {headerExtra && (
          <div className={styles.headerExtra} onClick={(e) => e.stopPropagation()}>
            {headerExtra}
          </div>
        )}
      </div>
      {isOpen && <div className={styles.body}>{children}</div>}
    </div>
  );
}
