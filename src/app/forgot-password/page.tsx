"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/portal/ui/Button";
import { Panel } from "@/components/portal/ui/Panel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "@/app/login/login.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setLoading(false);
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className={styles.page}>
      <Panel style={{ maxWidth: 360, width: "100%" }}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>SF</div>
            <div className={styles.brandText}>
              <b>StaffFlow Pro</b>
              <span>Портал подбора персонала</span>
            </div>
          </div>

          <h1 className={styles.title}>Восстановление пароля</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: -8 }}>
            Укажите email — пришлём ссылку для сброса пароля.
          </p>

          <div className={primitives.field}>
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {status === "sent" && (
            <p className={styles.success}>
              Если такой email зарегистрирован, письмо со ссылкой уже отправлено. Проверьте почту.
            </p>
          )}
          {status === "error" && (
            <p className={styles.error}>Не удалось отправить письмо. Попробуйте ещё раз позже.</p>
          )}

          <Button type="submit" variant="primary" disabled={loading} className={styles.submit}>
            {loading ? "Отправляем…" : "Отправить ссылку"}
          </Button>

          <a href="/login" className={styles.link}>
            Вернуться ко входу
          </a>
        </form>
      </Panel>
    </div>
  );
}
