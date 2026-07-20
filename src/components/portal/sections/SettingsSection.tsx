"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Modal } from "@/components/portal/ui/Modal";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { avatarColor, initials } from "@/lib/portal/format";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./SettingsSection.module.css";

interface TeamMember {
  name: string;
  role: string;
  projects: string;
}

const TEAM: TeamMember[] = [
  { name: "Елена Кравцова", role: "Рекрутер", projects: "Самокат, X5" },
  { name: "Никита Беляков", role: "Рекрутер", projects: "Купер" },
  { name: "Антон Захаров", role: "Менеджер проекта", projects: "Самокат, Яндекс Лавка" },
  { name: "Марина Волкова", role: "Менеджер проекта", projects: "Купер, Ozon Fresh" },
  { name: "Ольга Смирнова", role: "Координатор", projects: "Все проекты" },
];

const ROLE_OPTIONS = ["Рекрутер", "Менеджер проекта", "Координатор", "Администратор"];

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

export function SettingsSection() {
  const { pushToast, densityCompact, toggleDensity, setContextAction } = usePortal();

  const [name, setName] = useState("Дмитрий Кузнецов");
  const [role, setRole] = useState("HR-директор");
  const [email, setEmail] = useState("dmitry@staffflow.pro");
  const [phone, setPhone] = useState("+7 999 123-45-67");

  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);
  const [notifSettings, setNotifSettings] = useState(INITIAL_NOTIF_SETTINGS);
  const [tipsOn, setTipsOn] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  function saveProfile() {
    pushToast("Изменения профиля сохранены");
  }

  useEffect(() => {
    setContextAction({ label: "Сохранить изменения", onClick: saveProfile });
    return () => setContextAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContextAction]);

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
                  <label>Имя и фамилия</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className={primitives.field}>
                  <label>Роль</label>
                  <input type="text" value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
              </div>
              <div className={primitives.fieldRow} style={{ marginTop: 12 }}>
                <div className={primitives.field}>
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className={primitives.field}>
                  <label>Телефон</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            </PanelBody>
            <div className={styles.foot}>
              <Button variant="primary" onClick={saveProfile}>
                Сохранить изменения
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHead>
              <h3>Команда и роли</h3>
              <div className={styles.headActionSlot}>
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  + Пригласить
                </Button>
              </div>
            </PanelHead>
            <PanelBody>
              {TEAM.map((m) => (
                <div className={styles.teamRow} key={m.name}>
                  <div className={styles.teamAvatar} style={{ background: avatarColor(m.name) }}>
                    {initials(m.name)}
                  </div>
                  <div className={styles.txt}>
                    <b>{m.name}</b>
                    <span>{m.projects}</span>
                  </div>
                  <div className={styles.ctl}>
                    <select className={`${primitives.select} ${styles.roleSelect}`} defaultValue={m.role}>
                      {[m.role, ...ROLE_OPTIONS.filter((r) => r !== m.role)].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>

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
        </div>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pushToast } = usePortal();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Пригласить сотрудника"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              pushToast("Приглашение отправлено");
            }}
          >
            Отправить приглашение
          </Button>
        </>
      }
    >
      <div className={primitives.field}>
        <label>Email</label>
        <input type="email" placeholder="name@company.ru" />
      </div>
      <div className={primitives.field}>
        <label>Роль</label>
        <select defaultValue={ROLE_OPTIONS[0]}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}
