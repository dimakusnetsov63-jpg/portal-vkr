"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Drawer } from "@/components/portal/ui/Drawer";
import { ErrorState, SkeletonLines } from "@/components/portal/ui/StateViews";
import { fmtDate } from "@/lib/portal/format";
import { getChecklistTree, getReview } from "@/lib/supabase/qualityRepo";
import type { QualityChecklistTree, QualityReviewWithScores } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import {
  CALL_TYPE_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  asItemScale,
  formatPercent,
  leadUrl,
  scaleValueLabel,
  scoreTone,
} from "./qualityOptions";

/**
 * Карточка проверки — только чтение. Проценты берутся из строки
 * (`total_score`/`group_scores`), а не пересчитываются: показывать нужно ту
 * оценку, которую человек получил, даже если шаблон с тех пор поправили.
 */
export function ReviewDrawer({
  reviewId,
  onClose,
  onEdit,
}: {
  reviewId: string;
  onClose: () => void;
  onEdit: (review: QualityReviewWithScores) => void;
}) {
  const { canEdit } = usePortal();
  const [data, setData] = useState<QualityReviewWithScores | null>(null);
  const [tree, setTree] = useState<QualityChecklistTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка карточки проверки
    setLoading(true);
    setFailed(false);

    getReview(reviewId)
      .then(async (loaded) => {
        if (cancelled) return;
        setData(loaded);
        const loadedTree = await getChecklistTree(loaded.review.checklist_id);
        if (!cancelled) setTree(loadedTree);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const review = data?.review;
  const answers = new Map((data?.scores ?? []).map((score) => [score.item_id, score]));

  return (
    <Drawer open onClose={onClose} label="Карточка проверки качества">
      <header className={styles.drawerHead}>
        <div>
          <h3>{review ? review.employee_name : "Проверка"}</h3>
          {review && (
            <p>
              {KIND_LABELS[review.kind as "call" | "refusal"]} · {review.project} ·{" "}
              {fmtDate(new Date(review.review_date))}
            </p>
          )}
        </div>
        {review && <Badge color={scoreTone(review.total_score)}>{formatPercent(review.total_score)}</Badge>}
      </header>

      <div className={styles.drawerBody}>
        {loading && <SkeletonLines lines={10} />}
        {!loading && failed && <ErrorState onRetry={() => setData(null)} />}

        {!loading && review && (
          <>
            {review.has_critical && (
              <div className={`${primitives.banner} ${primitives.bannerCritical}`}>
                Критическая ошибка — итог обнулён независимо от остальных баллов.
              </div>
            )}

            <dl className={primitives.kvList}>
              <div className={primitives.kvRow}>
                <dt>Лид</dt>
                <dd>
                  <a href={leadUrl(review.crm_lead_id)} target="_blank" rel="noreferrer">
                    {review.crm_lead_id}
                  </a>
                </dd>
              </div>
              <div className={primitives.kvRow}>
                <dt>Проверяющий</dt>
                <dd>{review.reviewer_name}</dd>
              </div>
              <div className={primitives.kvRow}>
                <dt>Дата звонка</dt>
                <dd>{review.call_date ? fmtDate(new Date(review.call_date)) : "—"}</dd>
              </div>
              <div className={primitives.kvRow}>
                <dt>Тип звонка</dt>
                <dd>{review.call_type ? CALL_TYPE_LABELS[review.call_type as "incoming"] : "—"}</dd>
              </div>
              <div className={primitives.kvRow}>
                <dt>Должность / город</dt>
                <dd>
                  {review.position || "—"} / {review.city || "—"}
                </dd>
              </div>
              {review.kind === "refusal" && (
                <>
                  <div className={primitives.kvRow}>
                    <dt>Возражение</dt>
                    <dd>{review.objection || "—"}</dd>
                  </div>
                  <div className={primitives.kvRow}>
                    <dt>Целевой лид</dt>
                    <dd>{review.is_target === null ? "—" : review.is_target ? "Да" : "Нет"}</dd>
                  </div>
                  <div className={primitives.kvRow}>
                    <dt>Исходящих звонков</dt>
                    <dd>{review.outbound_calls ?? "—"}</dd>
                  </div>
                </>
              )}
              <div className={primitives.kvRow}>
                <dt>Статус</dt>
                <dd>{STATUS_LABELS[review.status] ?? review.status}</dd>
              </div>
              <div className={primitives.kvRow}>
                <dt>Версия шаблона</dt>
                <dd className={primitives.muted}>
                  {review.checklist_version}
                  {tree && tree.checklist.version !== review.checklist_version && " (шаблон с тех пор менялся)"}
                </dd>
              </div>
            </dl>

            {tree && (
              <div className={styles.checklist}>
                {tree.groups.map(({ group, items }) => (
                  <section key={group.id} className={styles.checklistGroup}>
                    <header className={styles.checklistGroupHead}>
                      <h4>
                        {group.title}
                        {!group.counts_in_total && <span className={styles.groupNote}>не входит в итог</span>}
                      </h4>
                      <Badge color={scoreTone(review.group_scores[group.id] ?? null)}>
                        {formatPercent(review.group_scores[group.id] ?? null)}
                      </Badge>
                    </header>
                    <div className={styles.checklistItems}>
                      {items.map((item) => {
                        const answer = answers.get(item.id);
                        return (
                          <div key={item.id} className={styles.checklistItem}>
                            <div className={styles.checklistItemTitle}>{item.title}</div>
                            <div className={primitives.muted}>
                              {!answer
                                ? "—"
                                : answer.is_na
                                  ? "н/д"
                                  : answer.value === null
                                    ? "—"
                                    : scaleValueLabel(asItemScale(item.scale), answer.value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {review.recommendations && (
              <div>
                <h4 className={styles.blockTitle}>Рекомендации и комментарии</h4>
                <p>{review.recommendations}</p>
              </div>
            )}

            {review.is_case && (
              <div>
                <h4 className={styles.blockTitle}>Кейс в аудиотеку</h4>
                <p>{review.case_comment || "Комментарий не заполнен."}</p>
              </div>
            )}
          </>
        )}
      </div>

      <footer className={styles.drawerFoot}>
        {canEdit("quality") && data && (
          <Button variant="primary" onClick={() => onEdit(data)}>
            Редактировать
          </Button>
        )}
        <Button onClick={onClose}>Закрыть</Button>
      </footer>
    </Drawer>
  );
}
