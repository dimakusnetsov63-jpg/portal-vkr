"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Modal.module.css";

export function Modal({
  open,
  onClose,
  title,
  wide,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Rendered via a portal straight to <body>: this is the only reliable way
  // to escape `position: sticky` ancestors (e.g. the demand matrix's sticky
  // first column), which create their own stacking context and would
  // otherwise trap the overlay behind other sticky elements (like the
  // matrix's sticky header/footer rows) regardless of this component's own
  // z-index.
  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`${styles.modal} ${wide ? styles.modalWide : ""}`}>
        <div className={styles.modalHead}>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="Закрыть">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFoot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
