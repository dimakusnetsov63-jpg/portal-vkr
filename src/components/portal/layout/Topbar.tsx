"use client";

import { useEffect, useRef, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { PAGE_TITLES } from "@/lib/portal/constants";
import { relativeTime } from "@/lib/portal/format";
import { NOTIF_TYPE_LABELS } from "@/lib/portal/notifications";
import { Icon } from "@/components/portal/ui/Icon";
import { Button } from "@/components/portal/ui/Button";
import { CommandPalette } from "@/components/portal/ui/CommandPalette";
import { DropdownFoot, DropdownHead, DropdownList, DropdownPanel } from "@/components/portal/ui/Dropdown";
import dropdownStyles from "@/components/portal/ui/Dropdown.module.css";
import styles from "./Topbar.module.css";

type OpenMenu = "notifications" | "profile" | null;

const NOTIF_ICO_CLASS = {
  critical: dropdownStyles.notifIcoCritical,
  important: dropdownStyles.notifIcoImportant,
  info: dropdownStyles.notifIcoInfo,
};

function userInitials(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  return local.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const {
    activePage,
    goto,
    openMobileSidebar,
    notifications,
    markAllNotificationsRead,
    contextAction,
    authEmail,
    signOut,
  } = usePortal();

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeydown);
    };
  }, []);

  return (
    <header className={styles.topbar} ref={wrapRef}>
      <button className={styles.menuBtn} aria-label="Открыть меню" onClick={openMobileSidebar}>
        <Icon name="menu" size={20} />
      </button>

      <h1 className={styles.title}>{PAGE_TITLES[activePage]}</h1>

      <button className={styles.search} onClick={() => setCommandOpen(true)}>
        <Icon name="search" size={16} />
        <span className={styles.searchPlaceholder}>Поиск по порталу…</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <div className={styles.actions}>
        <div style={{ position: "relative" }}>
          <button
            className={styles.iconBtn}
            aria-label="Уведомления"
            onClick={() => setOpenMenu((m) => (m === "notifications" ? null : "notifications"))}
          >
            <Icon name="bell" size={19} />
            {unread > 0 && <span className={styles.dot} />}
          </button>
          {openMenu === "notifications" && (
            <DropdownPanel>
              <DropdownHead>
                Уведомления{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(null);
                    goto("notifications");
                  }}
                >
                  Все
                </a>
              </DropdownHead>
              <DropdownList>
                {notifications.slice(0, 5).map((n) => {
                  const meta = NOTIF_TYPE_LABELS[n.type];
                  return (
                    <div
                      key={n.id}
                      className={`${dropdownStyles.notifItem} ${n.read ? "" : dropdownStyles.notifItemUnread}`}
                    >
                      <span className={`${dropdownStyles.notifIco} ${NOTIF_ICO_CLASS[n.type]}`}>
                        <Icon name={meta.icon as "alert" | "bell" | "info"} size={14} />
                      </span>
                      <div className={dropdownStyles.notifBody}>
                        <b>{n.title}</b>
                        <p>{n.text}</p>
                      </div>
                      <span className={dropdownStyles.notifTime}>{relativeTime(n.minsAgo)}</span>
                    </div>
                  );
                })}
              </DropdownList>
              <DropdownFoot>
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    markAllNotificationsRead();
                  }}
                >
                  Отметить всё прочитанным
                </button>
              </DropdownFoot>
            </DropdownPanel>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            className={styles.profileTrigger}
            onClick={() => setOpenMenu((m) => (m === "profile" ? null : "profile"))}
          >
            <div className={styles.avatar} style={{ background: "#5856d6" }}>
              {userInitials(authEmail)}
            </div>
          </button>
          {openMenu === "profile" && (
            <DropdownPanel narrow>
              <div className={dropdownStyles.profileHead}>
                <div className={styles.avatar} style={{ background: "#5856d6" }}>
                  {userInitials(authEmail)}
                </div>
                <div>
                  <b>Сотрудник</b>
                  <div>{authEmail ?? "Не авторизован"}</div>
                </div>
              </div>
              <button
                className={dropdownStyles.profileItem}
                onClick={() => {
                  setOpenMenu(null);
                  goto("settings");
                }}
              >
                <Icon name="gear" size={16} />
                Настройки
              </button>
              <button
                className={dropdownStyles.profileItem}
                onClick={() => {
                  setOpenMenu(null);
                  signOut();
                }}
              >
                <Icon name="logout" size={16} />
                Выйти
              </button>
            </DropdownPanel>
          )}
        </div>

        {contextAction && (
          <Button variant="primary" onClick={contextAction.onClick}>
            {contextAction.label}
          </Button>
        )}
      </div>

      {commandOpen && <CommandPalette onClose={() => setCommandOpen(false)} />}
    </header>
  );
}
