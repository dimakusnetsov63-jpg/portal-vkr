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
          style={{ marginTop: 6 }}
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
    <div>
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
