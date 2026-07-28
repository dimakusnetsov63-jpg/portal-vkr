import Link from "next/link";
import { Panel } from "@/components/portal/ui/Panel";
import styles from "@/app/login/login.module.css";

/**
 * Раздел закрыт для роли пользователя. Сюда уводит middleware, когда
 * запрошен раздел, которого у роли нет.
 */
export default function ForbiddenPage() {
  return (
    <div className={styles.page}>
      <Panel style={{ maxWidth: 420, width: "100%" }}>
        <div className={styles.form}>
          <div className={styles.brand}>
            <img src="/logo.svg" alt="ВКР" className={styles.brandMark} />
            <div className={styles.brandText}>
              <b>ВКР</b>
              <span>Ваш кадровый ресурс</span>
            </div>
          </div>

          <h1 className={styles.title}>Доступ запрещён</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>
            У вашей роли нет доступа к этому разделу. Если он нужен для работы, обратитесь к руководителю —
            права выдаются в разделе «Настройки → Команда и роли».
          </p>

          <Link href="/" className={styles.hint} style={{ color: "var(--accent)" }}>
            Вернуться в портал
          </Link>
        </div>
      </Panel>
    </div>
  );
}
