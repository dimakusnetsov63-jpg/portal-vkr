"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { avatarColor, initials } from "@/lib/portal/format";
import { BrandMark } from "@/components/portal/ui/BrandMark";
import { Icon } from "@/components/portal/ui/Icon";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const { activePage, goto, mobileSidebarOpen, closeMobileSidebar, notifications, currentUser, can } = usePortal();
  const unread = notifications.filter((n) => !n.read).length;

  // Меню показывает только разделы роли. Это удобство, а не защита: данные
  // закрыты RLS, маршруты — middleware.
  const navItems = NAV_ITEMS.filter((item) => can(item.id));

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
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            const badge = item.id === "notifications" ? unread : 0;
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                onClick={() => goto(item.id)}
              >
                <Icon name={item.icon} size={18} />
                <span className={styles.navLabel}>{item.label}</span>
                {badge > 0 && <span className={styles.navBadge}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className={styles.foot}>
          <button
            className={styles.userChip}
            onClick={() => goto("settings")}
            disabled={!can("settings")}
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
