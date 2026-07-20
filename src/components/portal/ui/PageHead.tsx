import type { ReactNode } from "react";
import styles from "./PageHead.module.css";

export function PageHead({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h2>{children}</h2>
    </div>
  );
}
