"use client";

import { useState, type FormEvent } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/portal/ui/Button";
import { Panel } from "@/components/portal/ui/Panel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "@/app/login/login.module.css";

type ErrorStatus = "rate_limited" | "provider_error" | "network_error" | "error";
type SubmitStatus = "idle" | "sent" | ErrorStatus;

const ERROR_MESSAGES: Record<ErrorStatus, string> = {
  rate_limited: "Слишком много попыток. Подождите немного и повторите запрос.",
  provider_error: "Временная проблема с отправкой писем. Попробуйте немного позже.",
  network_error: "Не удалось связаться с сервером. Проверьте соединение и повторите попытку.",
  error: "Не удалось отправить письмо. Попробуйте ещё раз позже.",
};

// Classifies a resetPasswordForEmail() error into a user-facing category.
// Deliberately never distinguishes "email not found" from anything else —
// resetPasswordForEmail itself doesn't either, to avoid user enumeration.
function classifyAuthError(error: AuthError): ErrorStatus {
  if (error.name === "AuthRetryableFetchError") return "network_error";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "rate_limited";
  }
  if (typeof error.status === "number" && error.status >= 500) return "provider_error";
  return "error";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
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

    if (error) {
      setStatus(classifyAuthError(error));
      return;
    }

    setStatus("sent");
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
          {status !== "idle" && status !== "sent" && <p className={styles.error}>{ERROR_MESSAGES[status]}</p>}

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
