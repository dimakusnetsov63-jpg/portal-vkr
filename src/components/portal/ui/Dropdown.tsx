import type { ReactNode } from "react";
import styles from "./Dropdown.module.css";

export function DropdownPanel({ narrow, children }: { narrow?: boolean; children: ReactNode }) {
  return <div className={`${styles.panel} ${narrow ? styles.panelNarrow : ""}`}>{children}</div>;
}

export function DropdownHead({ children }: { children: ReactNode }) {
  return <div className={styles.head}>{children}</div>;
}

export function DropdownList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}

export function DropdownFoot({ children }: { children: ReactNode }) {
  return <div className={styles.foot}>{children}</div>;
}
