"use client";

import { useEffect, useRef, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { PAGE_TITLES } from "@/lib/portal/constants";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { avatarColor, initials } from "@/lib/portal/format";
import { Icon } from "@/components/portal/ui/Icon";
import { Button } from "@/components/portal/ui/Button";
import { CommandPalette } from "@/components/portal/ui/CommandPalette";
import { DropdownPanel } from "@/components/portal/ui/Dropdown";
import dropdownStyles from "@/components/portal/ui/Dropdown.module.css";
import styles from "./Topbar.module.css";

// Раньше здесь было ещё значение "notifications": колокольчик открывал список
// выдуманных уведомлений, а точка на нём считалась по ним же (C-7). Список и
// колокольчик убраны до появления настоящего источника событий; раздел
// «Уведомления» остался в меню и честно сообщает, что он в разработке.
type OpenMenu = "profile" | null;

export function Topbar() {
  const { activePage, goto, openMobileSidebar, contextAction, currentUser, can, signOut } = usePortal();

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
            className={styles.profileTrigger}
            onClick={() => setOpenMenu((m) => (m === "profile" ? null : "profile"))}
          >
            <div className={styles.avatar} style={{ background: avatarColor(currentUser.full_name) }}>
              {initials(currentUser.full_name)}
            </div>
          </button>
          {openMenu === "profile" && (
            <DropdownPanel narrow>
              <div className={dropdownStyles.profileHead}>
                <div className={styles.avatar} style={{ background: avatarColor(currentUser.full_name) }}>
                  {initials(currentUser.full_name)}
                </div>
                <div>
                  <b>{currentUser.full_name}</b>
                  <div>{ROLE_LABELS[currentUser.role]}</div>
                </div>
              </div>
              {can("settings") && (
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
              )}
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
