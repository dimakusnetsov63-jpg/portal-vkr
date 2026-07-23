"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/portal/ui/Button";
import { Panel } from "@/components/portal/ui/Panel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "@/app/login/login.module.css";

const MIN_PASSWORD_LENGTH = 8;
const REDIRECT_DELAY_MS = 2000;

/**
 * Supabase redirects with `error` / `error_code` / `error_description` (in
 * the query string or the URL hash, depending on flow) when a recovery link
 * is invalid, expired, or already used — instead of the usual `?code=`.
 * Checked independently of the auth client, so it works even when the
 * client swallows the underlying exchange error (see below).
 */
function readAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const description =
    query.get("error_description") ?? hash.get("error_description") ?? query.get("error") ?? hash.get("error");
  return description ? decodeURIComponent(description.replace(/\+/g, " ")) : null;
}

type RecoveryState = "checking" | "ready" | "invalid";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkRecoverySession() {
      if (readAuthErrorFromUrl()) {
        if (!cancelled) setRecoveryState("invalid");
        return;
      }

      // createClient() triggers the browser client's automatic recovery-link
      // handling as soon as it's constructed: it reads `?code=` (our flow is
      // pinned to PKCE by createBrowserClient) or a `#access_token=...` hash
      // from the URL and establishes a session from it internally, exactly
      // once — that initialization is cached and idempotent, so awaiting
      // getSession() here (or calling createClient() again anywhere else)
      // never re-triggers it. We deliberately do NOT call
      // exchangeCodeForSession() ourselves: the code is already consumed by
      // the automatic flow, and exchanging it again would fail.
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setRecoveryState(data.session ? "ready" : "invalid");
    }

    checkRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Не удалось обновить пароль. Возможно, ссылка устарела — запросите новую.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
    setTimeout(() => router.replace("/login"), REDIRECT_DELAY_MS);
  }

  return (
    <div className={styles.page}>
      <Panel style={{ maxWidth: 360, width: "100%" }}>
        <div className={styles.form}>
          <div className={styles.brand}>
            <img src="/logo.svg" alt="ВКР" className={styles.brandMark} />
            <div className={styles.brandText}>
              <b>ВКР</b>
              <span>Ваш кадровый ресурс</span>
            </div>
          </div>

          <h1 className={styles.title}>Новый пароль</h1>

          {recoveryState === "checking" && (
            <p style={{ fontSize: 13, color: "var(--text-3)" }}>Проверяем ссылку…</p>
          )}

          {recoveryState === "invalid" && (
            <>
              <p className={styles.error}>Ссылка для сброса пароля недействительна или устарела.</p>
              <a href="/forgot-password" className={styles.link}>
                Запросить новую ссылку
              </a>
            </>
          )}

          {recoveryState === "ready" && success && (
            <p className={styles.success}>Пароль успешно изменён. Сейчас вы будете перенаправлены на страницу входа…</p>
          )}

          {recoveryState === "ready" && !success && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className={primitives.field}>
                <label htmlFor="update-password-new">Новый пароль</label>
                <input
                  id="update-password-new"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className={primitives.field}>
                <label htmlFor="update-password-confirm">Повторите пароль</label>
                <input
                  id="update-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <Button type="submit" variant="primary" disabled={loading} className={styles.submit}>
                {loading ? "Сохраняем…" : "Сохранить пароль"}
              </Button>
            </form>
          )}
        </div>
      </Panel>
    </div>
  );
}
