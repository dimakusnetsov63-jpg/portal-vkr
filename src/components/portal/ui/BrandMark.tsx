import styles from "./BrandMark.module.css";

export function BrandMark({ subtitle = "Ваш кадровый ресурс" }: { subtitle?: string }) {
  return (
    <>
      <img src="/logo.svg" alt="ВКР" className={styles.brandMark} />
      <div className={styles.brandText}>
        <b>ВКР</b>
        <span>{subtitle}</span>
      </div>
    </>
  );
}
