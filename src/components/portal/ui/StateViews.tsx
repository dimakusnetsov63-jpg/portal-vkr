import { Icon, type IconName } from "./Icon";
import { Button } from "./Button";
import styles from "./primitives.module.css";

function StateBlock({
  icon,
  error,
  title,
  text,
  action,
}: {
  icon: IconName;
  error?: boolean;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void; primary?: boolean };
}) {
  return (
    <div className={styles.stateBlock}>
      <div className={`${styles.stateIco} ${error ? styles.stateIcoError : ""}`}>
        <Icon name={icon} size={24} />
      </div>
      <h4>{title}</h4>
      <p>{text}</p>
      {action && (
        <Button
          variant={action.primary ? "primary" : "default"}
          size="sm"
          className={styles.stateAction}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, text, onReset }: { title: string; text: string; onReset?: () => void }) {
  return (
    <StateBlock
      icon="grid"
      title={title}
      text={text}
      action={onReset ? { label: "Сбросить фильтры", onClick: onReset } : undefined}
    />
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateBlock
      icon="alert"
      error
      title="Не удалось загрузить данные"
      text="Проверьте соединение и повторите попытку."
      action={{ label: "Повторить", onClick: onRetry, primary: true }}
    />
  );
}

export function NoDataState({ title, text }: { title: string; text: string }) {
  return <StateBlock icon="bar" title={title} text={text} />;
}

export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className={styles.skeletonRow} key={i}>
          <div className={styles.skeletonBlock} style={{ width: 180 }} />
          <div className={styles.skeletonBlock} style={{ width: 60 }} />
          <div className={styles.skeletonBlock} style={{ width: 60 }} />
          <div className={styles.skeletonBlock} style={{ width: 60 }} />
          <div className={styles.skeletonBlock} style={{ width: 60 }} />
          <div className={styles.skeletonBlock} style={{ width: 60, flex: 1 }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard placeholder. Takes the section's own grid class so the skeleton
 * lays out on exactly the same columns as the KPI row it stands in for —
 * otherwise the dashboard jumps when the numbers arrive.
 */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={className ?? styles.skeletonCardGrid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className={styles.skeletonCard} key={i}>
          <div className={styles.skeletonBlock} style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div className={styles.skeletonBlock} style={{ width: 64, height: 22 }} />
          <div className={styles.skeletonBlock} style={{ width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for list-shaped panel bodies (команда, журнал действий). */
export function SkeletonLines({ lines = 4 }: { lines?: number }) {
  return (
    <div className={styles.skeletonStack} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div className={styles.skeletonBlock} key={i} style={{ width: `${88 - i * 9}%` }} />
      ))}
    </div>
  );
}
