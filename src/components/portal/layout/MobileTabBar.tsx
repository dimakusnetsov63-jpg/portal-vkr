"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { Icon } from "@/components/portal/ui/Icon";
import type { PortalPage } from "@/lib/portal/types";
import styles from "./MobileTabBar.module.css";

const MOBILE_ITEM_IDS: PortalPage[] = ["overview", "demand", "candidates", "analytics", "settings"];
const MOBILE_ITEMS = MOBILE_ITEM_IDS.map((id) => NAV_ITEMS.find((item) => item.id === id)!);

export function MobileTabBar() {
  const { activePage, goto, can } = usePortal();
  // Отобранные пять пунктов минус закрытые для роли. Если после фильтра
  // осталось меньше пяти, добираем остальными доступными разделами: у
  // руководителя и координатора набор не меняется, у рекрутера панель не
  // схлопывается до одной кнопки.
  const preferred = MOBILE_ITEMS.filter((item) => can(item.id));
  const extra = NAV_ITEMS.filter((item) => can(item.id) && !preferred.includes(item));
  const visible = [...preferred, ...extra].slice(0, 5);

  return (
    <nav className={styles.tabbar}>
      {visible.map((item) => (
        <button
          key={item.id}
          className={activePage === item.id ? styles.tabbarButtonActive : ""}
          onClick={() => goto(item.id)}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
