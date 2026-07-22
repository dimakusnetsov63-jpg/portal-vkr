"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { CANDIDATE_LIST_TYPES, LIST_TYPE_LABELS } from "@/lib/portal/candidateOptions";
import { avatarColor, initials } from "@/lib/portal/format";
import type { CandidateListOption, CandidateListType } from "@/lib/supabase/candidateListOptions.types";
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

          <CandidateListsPanel />
        </div>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}

function CandidateListsPanel() {
  const {
    listOptions,
    listOptionsLoading,
    listOptionsError,
    refreshListOptions,
    addListOption,
    renameListOption,
    setListOptionActive,
    reorderListOption,
  } = usePortal();

  const [activeType, setActiveType] = useState<CandidateListType>("recruiter");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const rows = listOptions.filter((o) => o.list_type === activeType).sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd() {
    const value = newValue.trim();
    if (!value) return;
    setAdding(true);
    const ok = await addListOption(activeType, value);
    setAdding(false);
    if (ok) setNewValue("");
  }

  function startEdit(o: CandidateListOption) {
    setEditingId(o.id);
    setEditValue(o.value);
  }

  async function commitEdit() {
    const id = editingId;
    const value = editValue.trim();
    setEditingId(null);
    if (!id || !value) return;
    await renameListOption(id, value);
  }

  return (
    <Panel>
      <PanelHead>
        <h3>Списки для кандидатов</h3>
      </PanelHead>
      <PanelBody>
        <div className={primitives.seg} style={{ marginBottom: 14 }}>
          {CANDIDATE_LIST_TYPES.map((t) => (
            <button
              key={t}
              className={`${primitives.segButton} ${activeType === t ? primitives.segButtonActive : ""}`}
              onClick={() => {
                setActiveType(t);
                setEditingId(null);
              }}
            >
              {LIST_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {listOptionsLoading && <p style={{ fontSize: 13, color: "var(--text-3)" }}>Загрузка…</p>}
        {!listOptionsLoading && listOptionsError && (
          <p style={{ fontSize: 13, color: "var(--red)" }}>
            Не удалось загрузить списки.{" "}
            <button
              onClick={refreshListOptions}
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Повторить
            </button>
          </p>
        )}
        {!listOptionsLoading &&
          !listOptionsError &&
          (rows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-3)" }}>Список пуст.</p>
          ) : (
            rows.map((o, i) => (
              <div className={styles.settingsRow} key={o.id}>
                <div className={styles.reorderCtl}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => reorderListOption(o.id, "up")}
                    disabled={i === 0}
                    aria-label="Переместить вверх"
                  >
                    <span style={{ display: "inline-flex", transform: "rotate(-90deg)" }}>
                      <Icon name="chevron" size={13} />
                    </span>
                  </button>
                  <button
                    className={styles.iconBtn}
                    onClick={() => reorderListOption(o.id, "down")}
                    disabled={i === rows.length - 1}
                    aria-label="Переместить вниз"
                  >
                    <span style={{ display: "inline-flex", transform: "rotate(90deg)" }}>
                      <Icon name="chevron" size={13} />
                    </span>
                  </button>
                </div>
                {editingId === o.id ? (
                  <input
                    autoFocus
                    className={styles.listValueInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={commitEdit}
                  />
                ) : (
                  <button
                    className={`${styles.listValueText} ${o.is_active ? "" : styles.listValueInactive}`}
                    onClick={() => startEdit(o)}
                  >
                    {o.value}
                    {!o.is_active && <span className={styles.inactiveTag}>неактивно</span>}
                  </button>
                )}
                <div className={styles.ctl}>
                  <button
                    className={`${primitives.toggle} ${o.is_active ? primitives.toggleOn : ""}`}
                    onClick={() => setListOptionActive(o.id, !o.is_active)}
                    aria-label={o.is_active ? "Деактивировать" : "Активировать"}
                    title={o.is_active ? "Активно — виден в списках" : "Неактивно — скрыт из списков"}
                  />
                </div>
              </div>
            ))
          ))}

        <div className={styles.addRow}>
          <input
            type="text"
            placeholder={`Добавить в «${LIST_TYPE_LABELS[activeType]}»…`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !newValue.trim()}>
            <Icon name="plus" size={14} />
            Добавить
          </Button>
        </div>
      </PanelBody>
    </Panel>
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
