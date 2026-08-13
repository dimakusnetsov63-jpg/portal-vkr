"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { avatarColor, initials } from "@/lib/portal/format";
import { BrandMark } from "@/components/portal/ui/BrandMark";
import { Icon } from "@/components/portal/ui/Icon";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const { activePage, goto, mobileSidebarOpen, closeMobileSidebar, currentUser, isVisible } = usePortal();

  // Меню строится по `visible`, а не по праву читать раздел: это два разных
  // вопроса. Раздел можно убрать из навигации, оставив доступным по прямой
  // ссылке — тогда `visible = false`, но `can_view = true`, и middleware
  // такой переход не завернёт. Обратное сочетание невозможно: инвариант
  // can_view => visible держит CHECK-ограничение в базе.
  //
  // Это удобство, а не защита: данные закрыты RLS, маршруты — middleware.
  const navItems = NAV_ITEMS.filter((item) => isVisible(item.id));

  return (
    <>
      {mobileSidebarOpen && <div className={styles.scrim} onClick={closeMobileSidebar} />}
      <aside
        className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="Основная навигация"
      >
        <div className={styles.brand}>
          <BrandMark />
        </div>

        <nav className={styles.nav}>
          {/* Счётчика непрочитанных у «Уведомлений» больше нет: он считался по
              выдуманным записям и висел на каждом экране портала (C-7).
              Вернётся вместе с настоящим источником событий. */}
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                onClick={() => goto(item.id)}
              >
                <Icon name={item.icon} size={18} />
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.foot}>
          <button
            className={styles.userChip}
            onClick={() => goto("settings")}
            disabled={!isVisible("settings")}
          >
            <div className={styles.avatar} style={{ background: avatarColor(currentUser.full_name) }}>
              {initials(currentUser.full_name)}
            </div>
            <div className={styles.who}>
              <b>{currentUser.full_name}</b>
              <span>{ROLE_LABELS[currentUser.role]}</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
