"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { AuditLogPanel } from "./AuditLogPanel";
import { CandidateListsPanel } from "./CandidateListsPanel";
import { TeamPanel } from "./TeamPanel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./SettingsSection.module.css";

interface Integration {
  name: string;
  desc: string;
  on: boolean;
}

const INITIAL_INTEGRATIONS: Integration[] = [
  { name: "1С:Зарплата и управление персоналом", desc: "Синхронизация оформленных сотрудников", on: true },
  { name: "Telegram-бот уведомлений", desc: "Критические оповещения в чат команды", on: true },
  { name: "Google Календарь", desc: "Синхронизация выходов на смены", on: false },
  { name: "HR-система заказчика", desc: "Обмен статусами кандидатов по API", on: false },
];

interface NotifSetting {
  label: string;
  desc: string;
  on: boolean;
}

const INITIAL_NOTIF_SETTINGS: NotifSetting[] = [
  { label: "Email-уведомления", desc: "Дублировать критичные события на почту", on: true },
  { label: "Push-уведомления", desc: "Уведомления в браузере в реальном времени", on: true },
  { label: "Ежедневный дайджест", desc: "Сводка за день в 9:00 по МСК", on: false },
];

/**
 * Настройки: профиль, команда и роли, справочники, журнал действий.
 *
 * На реальных данных работают «Профиль» (текущая учётная запись),
 * «Команда и роли», «Журнал действий» и «Списки для кандидатов».
 * «Интеграции», «Уведомления» и «Отображение» — демонстрационные:
 * переключатели живут только в состоянии страницы и никуда не сохраняются.
 */
export function SettingsSection() {
  const { pushToast, densityCompact, toggleDensity, currentUser, can } = usePortal();

  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);
  const [notifSettings, setNotifSettings] = useState(INITIAL_NOTIF_SETTINGS);
  const [tipsOn, setTipsOn] = useState(true);

  const manageUsers = can("users");

  return (
    <>
      <PageHead eyebrow="Управление аккаунтом">Профиль, команда, уведомления и интеграции портала.</PageHead>

      <div className={primitives.grid2}>
        <div className={styles.column}>
          <Panel>
            <PanelHead>
              <h3>Профиль</h3>
            </PanelHead>
            <PanelBody>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>ФИО</label>
                  <input type="text" value={currentUser.full_name} disabled readOnly />
                </div>
                <div className={primitives.field}>
                  <label>Логин</label>
                  <input type="text" value={currentUser.login} disabled readOnly />
                </div>
              </div>
              <div className={primitives.fieldRow} style={{ marginTop: 12 }}>
                <div className={primitives.field}>
                  <label>Роль</label>
                  <input type="text" value={ROLE_LABELS[currentUser.role]} disabled readOnly />
                </div>
                <div className={primitives.field}>
                  <label>Проекты</label>
                  <input type="text" value={currentUser.projects.join(", ")} disabled readOnly />
                </div>
              </div>
              <p className={styles.fieldNote} style={{ marginTop: 12 }}>
                Учётные записи заводит и меняет руководитель в разделе «Команда и роли». Забытый пароль он же задаёт
                заново — самостоятельного восстановления в портале нет.
              </p>
            </PanelBody>
          </Panel>

          {manageUsers && <TeamPanel />}

          <Panel>
            <PanelHead>
              <h3>Интеграции</h3>
            </PanelHead>
            <PanelBody>
              {integrations.map((it, i) => (
                <div className={styles.settingsRow} key={it.name}>
                  <div className={styles.txt}>
                    <b>{it.name}</b>
                    <span>{it.desc}</span>
                  </div>
                  <div className={styles.ctl}>
                    <button
                      className={`${primitives.toggle} ${it.on ? primitives.toggleOn : ""}`}
                      onClick={() => {
                        setIntegrations((prev) => prev.map((x, xi) => (xi === i ? { ...x, on: !x.on } : x)));
                        pushToast(it.on ? "Интеграция отключена" : "Интеграция подключена");
                      }}
                    />
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel>
            <PanelHead>
              <h3>Уведомления</h3>
            </PanelHead>
            <PanelBody>
              {notifSettings.map((s, i) => (
                <div className={styles.settingsRow} key={s.label}>
                  <div className={styles.txt}>
                    <b>{s.label}</b>
                    <span>{s.desc}</span>
                  </div>
                  <div className={styles.ctl}>
                    <button
                      className={`${primitives.toggle} ${s.on ? primitives.toggleOn : ""}`}
                      onClick={() => setNotifSettings((prev) => prev.map((x, xi) => (xi === i ? { ...x, on: !x.on } : x)))}
                    />
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead>
              <h3>Отображение</h3>
            </PanelHead>
            <PanelBody>
              <div className={styles.settingsRow}>
                <div className={styles.txt}>
                  <b>Плотность таблиц</b>
                  <span>Компактный режим уменьшает высоту строк</span>
                </div>
                <div className={styles.ctl}>
                  <button
                    className={`${primitives.toggle} ${densityCompact ? primitives.toggleOn : ""}`}
                    onClick={toggleDensity}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.txt}>
                  <b>Показывать подсказки</b>
                  <span>Всплывающие пояснения к элементам интерфейса</span>
                </div>
                <div className={styles.ctl}>
                  <button
                    className={`${primitives.toggle} ${tipsOn ? primitives.toggleOn : ""}`}
                    onClick={() => setTipsOn((v) => !v)}
                  />
                </div>
              </div>
            </PanelBody>
          </Panel>

          <CandidateListsPanel />

          {manageUsers && <AuditLogPanel />}
        </div>
      </div>
    </>
  );
}
