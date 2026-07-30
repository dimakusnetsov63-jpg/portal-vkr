"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "./Icon";
import styles from "./ToastStack.module.css";

export function ToastStack() {
  const { toasts } = usePortal();
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className={styles.toast} key={t.id}>
          <span className={`${styles.toastIcon} ${t.type === "error" ? styles.toastIconError : ""}`}>
            <Icon name={t.type === "error" ? "alert" : "check"} size={14} />
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
