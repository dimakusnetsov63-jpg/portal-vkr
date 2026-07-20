"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Drawer } from "@/components/portal/ui/Drawer";
import { Icon } from "@/components/portal/ui/Icon";
import { STAGE_TIMELINE_ORDER, projectById, stageById } from "@/lib/portal/constants";
import { avatarColor, fmtDateTime, initials } from "@/lib/portal/format";
import type { Candidate } from "@/lib/portal/types";
import styles from "./CandidateDrawer.module.css";

const TIMELINE_LABELS: Record<(typeof STAGE_TIMELINE_ORDER)[number], string> = {
  response: "Новый отклик",
  invited: "Приглашён",
  interview: "Собеседование",
  processing: "Оформление",
  confirmed: "Выход подтверждён",
  first_shift: "1-я смена",
};

function timelineDate(c: Candidate, stageId: (typeof STAGE_TIMELINE_ORDER)[number]): Date | null {
  switch (stageId) {
    case "response":
      return c.responseAt;
    case "invited":
      return c.invitedAt;
    case "interview":
      return c.interviewAt;
    case "processing":
      return c.processedAt;
    case "confirmed":
      return c.processedAt;
    case "first_shift":
      return c.firstShiftAt;
    default:
      return null;
  }
}

export function CandidateDrawer({ candidateId }: { candidateId: string | null }) {
  const { candidates, closeCandidateDrawer, addComment } = usePortal();
  const [commentText, setCommentText] = useState("");

  const candidate = candidateId ? candidates.find((c) => c.id === candidateId) : undefined;
  const isTerminalBad = candidate ? candidate.stage === "rejected" || candidate.stage === "no_show" : false;

  function handleSendComment() {
    if (!candidate) return;
    const text = commentText.trim();
    if (!text) return;
    addComment(candidate.id, text);
    setCommentText("");
  }

  return (
    <Drawer open={!!candidate} onClose={closeCandidateDrawer}>
      {candidate && (
        <>
          <div className={styles.head}>
            <div className={styles.avatar} style={{ background: avatarColor(candidate.fio) }}>
              {initials(candidate.fio)}
            </div>
            <div>
              <h3>{candidate.fio}</h3>
              <p>
                {candidate.id} · {projectById(candidate.project)?.name}, {candidate.city}
              </p>
            </div>
            <button className={styles.close} onClick={closeCandidateDrawer} aria-label="Закрыть">
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className={styles.body}>
            <div>
              <Badge color={stageById(candidate.stage).color}>{stageById(candidate.stage).name}</Badge>
            </div>

            <div className={styles.section}>
              <h4>Ответственные</h4>
              <div className={styles.infoGrid}>
                <div>
                  <span>Рекрутер</span>
                  <b>{candidate.recruiter}</b>
                </div>
                <div>
                  <span>Менеджер проекта</span>
                  <b>{candidate.manager}</b>
                </div>
                <div>
                  <span>Координатор</span>
                  <b>{candidate.coordinator}</b>
                </div>
                <div>
                  <span>ID кандидата</span>
                  <b>{candidate.id}</b>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Временная шкала этапов</h4>
              <div className={styles.timeline}>
                {STAGE_TIMELINE_ORDER.map((stageId, idx) => {
                  const date = timelineDate(candidate, stageId);
                  return (
                    <div className={styles.tlItem} key={stageId}>
                      <div className={styles.tlDotWrap}>
                        <div className={`${styles.tlDot} ${date ? "" : styles.tlDotPending}`} />
                        {idx < STAGE_TIMELINE_ORDER.length - 1 && <div className={styles.tlLine} />}
                      </div>
                      <div className={date ? "" : styles.tlMainPending}>
                        <b>{TIMELINE_LABELS[stageId]}</b>
                        <span>{date ? fmtDateTime(date) : "Ожидается"}</span>
                      </div>
                    </div>
                  );
                })}
                {isTerminalBad && (
                  <div className={styles.tlItem}>
                    <div className={styles.tlDotWrap}>
                      <div className={styles.tlDot} style={{ background: "var(--red)" }} />
                    </div>
                    <div>
                      <b style={{ color: "var(--red)" }}>{stageById(candidate.stage).name}</b>
                      <span>Причина: не подтвердил выход по телефону</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.section}>
              <h4>Комментарии</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {candidate.comments.length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--text-3)" }}>Комментариев пока нет.</p>
                )}
                {candidate.comments.map((cm, i) => (
                  <div className={styles.comment} key={i}>
                    <div className={styles.commentWho}>
                      <b>{cm.who}</b>
                      <span>{fmtDateTime(cm.at)}</span>
                    </div>
                    <p>{cm.text}</p>
                  </div>
                ))}
              </div>
              <div className={styles.commentInput} style={{ marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="Добавить комментарий…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendComment();
                  }}
                />
                <Button size="sm" onClick={handleSendComment}>
                  Отправить
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
