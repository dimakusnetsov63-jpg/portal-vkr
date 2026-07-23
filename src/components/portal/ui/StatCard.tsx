import { Icon, type IconName } from "./Icon";
import styles from "./primitives.module.css";

export interface StatCardProps {
  icon?: IconName;
  value: string | number;
  /** Optional line rendered between the value and the label, e.g. a percentage. */
  sublabel?: string;
  label: string;
  delta?: string;
  deltaTone?: "up" | "down" | "flat";
}

const DELTA_CLASS = {
  up: styles.statDeltaUp,
  down: styles.statDeltaDown,
  flat: styles.statDeltaFlat,
};

export function StatCard({ icon, value, sublabel, label, delta, deltaTone = "flat" }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      {(icon || delta) && (
        <div className={styles.statTop}>
          {icon ? (
            <div className={styles.statIco}>
              <Icon name={icon} size={16} />
            </div>
          ) : (
            <span />
          )}
          {delta && <span className={`${styles.statDelta} ${DELTA_CLASS[deltaTone]}`}>{delta}</span>}
        </div>
      )}
      <div className={styles.statValue}>{value}</div>
      {sublabel && <div className={styles.statSubValue}>{sublabel}</div>}
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
