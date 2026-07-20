"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { EmptyState } from "@/components/portal/ui/StateViews";
import { relativeTime } from "@/lib/portal/format";
import { NOTIF_TYPE_LABELS } from "@/lib/portal/notifications";
import type { NotificationType } from "@/lib/portal/types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./NotificationsSection.module.css";

type Filter = "all" | "unread" | NotificationType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "unread", label: "Непрочитанные" },
  { value: "critical", label: "Критичные" },
  { value: "important", label: "Важные" },
  { value: "info", label: "Инфо" },
];

const ICO_CLASS: Record<NotificationType, string> = {
  critical: styles.icoCritical,
  important: styles.icoImportant,
  info: styles.icoInfo,
};

export function NotificationsSection() {
  const { notifications, markNotificationRead, markAllNotificationsRead, setContextAction } = usePortal();
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setContextAction({ label: "Отметить всё прочитанным", onClick: markAllNotificationsRead });
    return () => setContextAction(null);
  }, [setContextAction, markAllNotificationsRead]);

  const list = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "all") return true;
      if (filter === "unread") return !n.read;
      return n.type === filter;
    });
  }, [notifications, filter]);

  return (
    <>
      <PageHead eyebrow="Центр уведомлений">
        Критические события, важные изменения и информационные сообщения портала.
      </PageHead>

      <Panel>
        <div className={primitives.toolbar}>
          <div className={primitives.seg}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={`${primitives.segButton} ${filter === f.value ? primitives.segButtonActive : ""}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState
            title="Уведомлений нет"
            text="В выбранной категории пока нет сообщений."
            onReset={() => setFilter("all")}
          />
        ) : (
          <div>
            {list.map((n) => {
              const meta = NOTIF_TYPE_LABELS[n.type];
              return (
                <div className={`${styles.item} ${n.read ? "" : styles.itemUnread}`} key={n.id}>
                  <div className={`${styles.ico} ${ICO_CLASS[n.type]}`}>
                    <Icon name={meta.icon as "alert" | "bell" | "info"} size={16} />
                  </div>
                  <div className={styles.body}>
                    <div className={styles.top}>
                      <b>{n.title}</b>
                      <span className={styles.tag}>{n.project}</span>
                    </div>
                    <p className={styles.text}>{n.text}</p>
                    <div className={styles.foot}>
                      <span>{relativeTime(n.minsAgo)}</span>
                      {!n.read && <button onClick={() => markNotificationRead(n.id)}>Отметить прочитанным</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
