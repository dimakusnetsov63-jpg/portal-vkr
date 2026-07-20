"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { Icon } from "@/components/portal/ui/Icon";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const { activePage, goto, mobileSidebarOpen, closeMobileSidebar, notifications } = usePortal();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      {mobileSidebarOpen && <div className={styles.scrim} onClick={closeMobileSidebar} />}
      <aside
        className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="Основная навигация"
      >
        <div className={styles.brand}>
          <div className={styles.brandMark}>SF</div>
          <div className={styles.brandText}>
            <b>StaffFlow Pro</b>
            <span>Портал подбора персонала</span>
          </div>
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
              ДК
            </div>
            <div className={styles.who}>
              <b>Дмитрий Кузнецов</b>
              <span>HR-директор</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
