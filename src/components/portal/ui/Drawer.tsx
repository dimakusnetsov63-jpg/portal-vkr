"use client";

import { useEffect, type ReactNode } from "react";
import styles from "./Drawer.module.css";

export function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
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

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`} aria-label="Карточка кандидата">
        {open && children}
      </aside>
    </>
  );
}
