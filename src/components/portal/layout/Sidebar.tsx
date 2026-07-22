"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { BrandMark } from "@/components/portal/ui/BrandMark";
import { Icon } from "@/components/portal/ui/Icon";
import styles from "./Sidebar.module.css";

function userInitials(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  return local.slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const { activePage, goto, mobileSidebarOpen, closeMobileSidebar, notifications, authEmail } = usePortal();
  const unread = notifications.filter((n) => !n.read).length;

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
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const badge = item.id === "notifications" ? unread : 0;
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                onClick={() => goto(item.id)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {badge > 0 && <span className={styles.navBadge}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className={styles.foot}>
          <button className={styles.userChip} onClick={() => goto("settings")}>
            <div className={styles.avatar} style={{ background: "#5856d6" }}>
              {userInitials(authEmail)}
            </div>
            <div className={styles.who}>
              <b>{authEmail ?? "Не авторизован"}</b>
              <span>Сотрудник</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
