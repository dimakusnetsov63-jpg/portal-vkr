"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Panel } from "@/components/portal/ui/Panel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./login.module.css";

/**
 * Вход по логину и паролю. Учётные записи заводит администратор в разделе
 * «Настройки → Команда и роли»; самостоятельной регистрации и восстановления
 * пароля нет — забытый пароль задаёт заново администратор.
 */
export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let message: string | null = null;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        message = data?.error ?? "Не удалось войти";
      }
    } catch {
      message = "Сервер недоступен. Проверьте соединение";
    }

    setLoading(false);
    if (message) {
      setError(message);
      return;
    }

    setPassword("");
    // refresh() нужен вместе с replace(): портал — серверный компонент,
    // и без сброса кэша роутера он отрендерится с прежней (пустой) сессией.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <Panel style={{ maxWidth: 360, width: "100%" }}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.brand}>
            <img src="/logo.svg" alt="ВКР" className={styles.brandMark} />
            <div className={styles.brandText}>
              <b>ВКР</b>
              <span>Ваш кадровый ресурс</span>
            </div>
          </div>

          <h1 className={styles.title}>Вход</h1>

          <div className={primitives.field}>
            <label htmlFor="login-name">Логин</label>
            <input
              id="login-name"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div className={primitives.field}>
            <label htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" disabled={loading} className={styles.submit}>
            {loading ? "Входим…" : "Войти"}
          </Button>

          <p className={styles.hint}>Доступ выдаёт администратор портала.</p>
        </form>
      </Panel>
    </div>
  );
}
