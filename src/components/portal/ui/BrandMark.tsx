import styles from "./BrandMark.module.css";

export function BrandMark({ subtitle = "Портал подбора персонала" }: { subtitle?: string }) {
  return (
    <>
      <div className={styles.brandMark}>SF</div>
      <div className={styles.brandText}>
        <b>StaffFlow Pro</b>
        <span>{subtitle}</span>
      </div>
    </>
  );
}
