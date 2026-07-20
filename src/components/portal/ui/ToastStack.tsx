"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "./Icon";
import styles from "./ToastStack.module.css";

export function ToastStack() {
  const { toasts } = usePortal();
  return (
    <div className={styles.stack}>
      {toasts.map((t) => (
        <div className={styles.toast} key={t.id}>
          <span className={t.type === "error" ? styles.toastIconError : styles.toastIcon}>
            <Icon name={t.type === "error" ? "alert" : "check"} size={16} />
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
