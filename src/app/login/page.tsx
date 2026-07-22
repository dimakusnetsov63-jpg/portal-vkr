"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/portal/ui/Button";
import { Panel } from "@/components/portal/ui/Panel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Неверный email или пароль");
      return;
    }
    setPassword("");
    router.replace("/");
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

          <h1 className={styles.title}>Вход</h1>

          <div className={primitives.field}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
        </form>
      </Panel>
    </div>
  );
}
