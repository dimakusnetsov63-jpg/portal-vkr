import type { ReactNode } from "react";
import styles from "./primitives.module.css";

export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={styles.panel} style={style}>
      {children}
    </div>
  );
}

export function PanelHead({ children }: { children: ReactNode }) {
  return <div className={styles.panelHead}>{children}</div>;
}

export function PanelHeadSub({ children }: { children: ReactNode }) {
  return <span className={styles.panelHeadSub}>{children}</span>;
}

export function PanelBody({ children }: { children: ReactNode }) {
  return <div className={styles.panelBody}>{children}</div>;
}
