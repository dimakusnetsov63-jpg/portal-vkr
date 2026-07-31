"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/portal/ui/Button";
import { Modal } from "@/components/portal/ui/Modal";
import { usePortal } from "@/components/portal/context/PortalContext";
import { PORTAL_ROLES, ROLE_LABELS, type PortalRole } from "@/lib/auth/roles";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { isPortalLoginAvailable } from "@/lib/supabase/portalUsersRepo";
import type { PortalUser } from "@/lib/supabase/portalAuth.types";
import {
  MIN_PASSWORD_LENGTH,
  hasErrors,
  normalizeLogin,
  validateUserForm,
  type UserFormErrors,
  type UserFormValues,
} from "./userForm";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./SettingsSection.module.css";

/** Задержка перед проверкой логина: он проверяется во время ввода, но не на каждый символ. */
const LOGIN_CHECK_DEBOUNCE_MS = 400;

type LoginCheck = "idle" | "checking" | "free" | "taken";

export interface UserFormSubmit {
  fullName: string;
  login: string;
  /** Пустая строка при редактировании = пароль не меняется. */
  password: string;
  role: PortalRole;
  projects: string[];
  isActive: boolean;
}

function initialValues(user: PortalUser | null): UserFormValues {
  return {
    fullName: user?.full_name ?? "",
    login: user?.login ?? "",
    // Действующий пароль не показывается и не подставляется: портал его не
    // знает — в базе лежит только хеш.
    password: "",
    confirmPassword: "",
    role: user?.role ?? "recruiter",
    projects: user?.projects ?? [],
    isActive: user?.is_active ?? true,
  };
}

export function UserFormModal({
  open,
  user,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** null — создание новой учётной записи. */
  user: PortalUser | null;
  onClose: () => void;
  /** Возвращает текст ошибки для показа в форме или null, если всё сохранилось. */
  onSubmit: (values: UserFormSubmit) => Promise<string | null>;
}) {
  const { listOptions } = usePortal();
  const projectOptions = activeListOptions(listOptions, "project").map((o) => o.value);
  const mode = user ? "edit" : "create";
  const [values, setValues] = useState<UserFormValues>(() => initialValues(user));
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [loginCheck, setLoginCheck] = useState<LoginCheck>("idle");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Каждое открытие начинается с чистой формы — в том числе с пустых полей
  // пароля, чтобы прошлый ввод не утёк в следующую учётную запись.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии модалки
    setValues(initialValues(user));
    setErrors({});
    setLoginCheck("idle");
    setFormError(null);
  }, [open, user]);

  const login = normalizeLogin(values.login);

  // Проверка занятости логина во время ввода. Состояние меняется только из
  // колбэка таймера: сбрасывает его сам обработчик ввода (см. onChange), а не
  // эффект — синхронный setState в теле эффекта дал бы каскад рендеров.
  useEffect(() => {
    if (!open || mode !== "create" || !login) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoginCheck("checking");
      try {
        const free = await isPortalLoginAvailable(login);
        if (!cancelled) setLoginCheck(free ? "free" : "taken");
      } catch {
        // Проверку не удалось выполнить — не мешаем вводу. Настоящую
        // уникальность всё равно гарантирует индекс в базе.
        if (!cancelled) setLoginCheck("idle");
      }
    }, LOGIN_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [login, mode, open]);

  function set<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setLoginValue(value: string) {
    set("login", value);
    setLoginCheck("idle");
  }

  function toggleProject(project: string) {
    setValues((prev) => ({
      ...prev,
      projects: prev.projects.includes(project)
        ? prev.projects.filter((p) => p !== project)
        : [...prev.projects, project],
    }));
  }

  async function handleSubmit() {
    const nextErrors = validateUserForm(values, mode);
    setErrors(nextErrors);
    setFormError(null);
    if (hasErrors(nextErrors)) return;
    if (mode === "create" && loginCheck === "taken") {
      setErrors({ login: "Логин уже занят" });
      return;
    }

    setSaving(true);
    const message = await onSubmit({
      fullName: values.fullName.trim(),
      login,
      password: values.password,
      role: values.role,
      projects: values.projects,
      isActive: values.isActive,
    });
    setSaving(false);
    // Ошибка базы (занятый логин, последний руководитель) остаётся в форме:
    // закрывать её вместе с введёнными данными — значит заставить набирать
    // всё заново.
    if (message) setFormError(message);
    else onClose();
  }

  const allProjectsSelected = values.projects.length === projectOptions.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Новый пользователь" : "Изменение пользователя"}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохраняем…" : mode === "create" ? "Создать" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className={styles.formStack}>
        {formError && <p className={styles.formError}>{formError}</p>}

        <div className={primitives.field}>
          <label htmlFor="user-form-name">ФИО *</label>
          <input
            id="user-form-name"
            type="text"
            value={values.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
          {errors.fullName && <span className={styles.fieldError}>{errors.fullName}</span>}
        </div>

        {mode === "create" ? (
          <div className={primitives.field}>
            <label htmlFor="user-form-login">Логин *</label>
            <input
              id="user-form-login"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={values.login}
              onChange={(e) => setLoginValue(e.target.value)}
            />
            {errors.login && <span className={styles.fieldError}>{errors.login}</span>}
            {!errors.login && loginCheck === "checking" && <span className={styles.fieldNote}>Проверяем логин…</span>}
            {!errors.login && loginCheck === "free" && <span className={styles.fieldOk}>Логин свободен</span>}
            {!errors.login && loginCheck === "taken" && <span className={styles.fieldError}>Логин уже занят</span>}
          </div>
        ) : (
          <div className={primitives.field}>
            <label>Логин</label>
            <input type="text" value={values.login} disabled readOnly />
            <span className={styles.fieldNote}>Логин не меняется — по нему связаны записи журнала.</span>
          </div>
        )}

        <div className={primitives.fieldRow}>
          <div className={primitives.field}>
            <label htmlFor="user-form-password">{mode === "create" ? "Пароль *" : "Новый пароль"}</label>
            <input
              id="user-form-password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
            />
            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
            {!errors.password && mode === "edit" && (
              <span className={styles.fieldNote}>Оставьте пустым, чтобы не менять.</span>
            )}
            {!errors.password && mode === "create" && (
              <span className={styles.fieldNote}>Не короче {MIN_PASSWORD_LENGTH} символов.</span>
            )}
          </div>
          <div className={primitives.field}>
            <label htmlFor="user-form-password-confirm">
              {mode === "create" ? "Подтверждение пароля *" : "Подтверждение"}
            </label>
            <input
              id="user-form-password-confirm"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
            />
            {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
          </div>
        </div>

        <div className={primitives.field}>
          <label htmlFor="user-form-role">Роль *</label>
          <select
            id="user-form-role"
            value={values.role}
            onChange={(e) => set("role", e.target.value as PortalRole)}
          >
            {PORTAL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className={primitives.field}>
          <label>Проекты *</label>
          <div className={styles.projectPicker}>
            <button
              type="button"
              className={`${styles.projectChip} ${allProjectsSelected ? styles.projectChipOn : ""}`}
              onClick={() => set("projects", allProjectsSelected ? [] : [...projectOptions])}
            >
              Все проекты
            </button>
            {projectOptions.map((project) => (
              <button
                key={project}
                type="button"
                className={`${styles.projectChip} ${values.projects.includes(project) ? styles.projectChipOn : ""}`}
                onClick={() => toggleProject(project)}
              >
                {project}
              </button>
            ))}
          </div>
          {errors.projects && <span className={styles.fieldError}>{errors.projects}</span>}
        </div>

        <div className={styles.inlineToggleRow}>
          <div className={styles.txt}>
            <b>Активен</b>
            <span>Отключённый сотрудник не может войти в портал</span>
          </div>
          <div className={styles.ctl}>
            <button
              type="button"
              className={`${primitives.toggle} ${values.isActive ? primitives.toggleOn : ""}`}
              onClick={() => set("isActive", !values.isActive)}
              aria-label={values.isActive ? "Отключить" : "Включить"}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
