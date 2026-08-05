"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { AuditLogPanel } from "./AuditLogPanel";
import { CandidateListsPanel } from "./CandidateListsPanel";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { TeamPanel } from "./TeamPanel";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./SettingsSection.module.css";

/**
 * Настройки: профиль, команда и роли, справочники, журнал действий,
 * отображение.
 *
 * Все панели работают на реальных данных. Раньше здесь были ещё три
 * демонстрационные — «Интеграции» (переключатель отвечал тостом
 * «Интеграция подключена», ничего не подключая), «Уведомления» (email/push/
 * дайджест, состояние жило до перезагрузки) и «Показывать подсказки»
 * (переключатель не делал ничего вообще). Удалены в C-7.
 *
 * «Плотность таблиц» осталась — она действительно работает, вешая класс на
 * `body`. Её единственное ограничение в том, что выбор не сохраняется между
 * сессиями; это отсутствующая функция, а не имитация существующей.
 */
export function SettingsSection() {
  const { densityCompact, toggleDensity, currentUser, can } = usePortal();

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
        </div>

        <div className={styles.column}>
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
            </PanelBody>
          </Panel>

          <CandidateListsPanel />

          {manageUsers && <ImportHistoryPanel />}

          {manageUsers && <AuditLogPanel />}
        </div>
      </div>
    </>
  );
}
