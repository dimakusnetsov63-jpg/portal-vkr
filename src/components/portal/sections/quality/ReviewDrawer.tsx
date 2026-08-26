"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Drawer } from "@/components/portal/ui/Drawer";
import { ErrorState, SkeletonLines } from "@/components/portal/ui/StateViews";
import { fmtDate } from "@/lib/portal/format";
import { getReview, setReviewArchived } from "@/lib/supabase/qualityRepo";
import type { QualityReviewWithScores } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { CALL_TYPE_LABELS, KIND_LABELS, STATUS_LABELS, formatPercent, leadUrl, scoreTone } from "./qualityOptions";
import { buildReviewSnapshot, formatAnswer } from "./reviewSnapshot";

/**
 * Карточка проверки — только чтение. Проценты берутся из строки
 * (`total_score`/`group_scores`), а не пересчитываются: показывать нужно ту
 * оценку, которую человек получил, даже если шаблон с тех пор поправили.
 */
export function ReviewDrawer({
  reviewId,
  onClose,
  onEdit,
  onChanged,
}: {
  reviewId: string;
  onClose: () => void;
  onEdit: (review: QualityReviewWithScores) => void;
  /** Перезагрузить реестр: архивация меняет состав выдачи. */
  onChanged?: () => void;
}) {
  const { canEdit, pushToast } = usePortal();
  const [archiving, setArchiving] = useState(false);
  const [data, setData] = useState<QualityReviewWithScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /**
   * Загрузка карточки — отдельным колбэком, а не телом эффекта, чтобы её мог
   * позвать и эффект, и кнопка «Повторить». Раньше `onRetry` сбрасывал
   * `data` в null, но эффект зависел только от `reviewId`, который при этом
   * не менялся: кнопка не делала ничего вовсе (BUG-06 аудита).
   */
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    getReview(reviewId)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка карточки проверки
    return load();
  }, [load]);

  async function toggleArchived() {
    if (!data) return;
    const archived = data.review.archived_at === null;
    setArchiving(true);
    try {
      await setReviewArchived(data.review.id, archived);
      pushToast(archived ? "Проверка убрана в архив" : "Проверка возвращена в работу");
      onChanged?.();
      onClose();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Не удалось изменить состояние проверки", "error");
    } finally {
      setArchiving(false);
    }
  }

  const review = data?.review;

  // Проверка рисуется из собственных ответов: каждый несёт снимок
  // формулировки, блока и порядка на момент сохранения. К шаблону здесь
  // обращаться нельзя — он мог измениться (B2).
  const snapshot = data ? buildReviewSnapshot(data.scores, data.review.group_scores) : [];

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
        {!loading && failed && (
          <ErrorState
            onRetry={() => {
              load();
            }}
          />
        )}

        {!loading && review && (
          <>
            {review.archived_at && (
              <div className={primitives.banner}>
                Проверка в архиве: она не попадает ни в реестр, ни в сводки.
              </div>
            )}

            {review.has_critical && (
              <div className={`${primitives.banner} ${primitives.bannerCritical}`}>
                Критическая ошибка — итог обнулён независимо от остальных баллов.
              </div>
            )}

            {/*
              Нарушение обнуляет итог так же, как критический пункт, но это
              разные причины: без отдельного баннера человек видел бы итог 0
              и ни одного объяснения рядом.
            */}
            {review.violation && (
              <div className={`${primitives.banner} ${primitives.bannerCritical}`}>
                Нарушение: {review.violation}. Итог обнулён независимо от остальных баллов.
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
              {/*
                Тип звонка, должность, город, целевой лид и число исходящих
                20 августа убраны из формы: команда КЦ их не заполняла.
                Строки в карточке показываются только когда значение есть —
                у трёх заведённых до этого проверок оно записано, и прятать
                его не за что. У новых проверок этих строк просто не будет.
              */}
              {review.call_type && (
                <div className={primitives.kvRow}>
                  <dt>Тип звонка</dt>
                  <dd>{CALL_TYPE_LABELS[review.call_type as "incoming"]}</dd>
                </div>
              )}
              {(review.position || review.city) && (
                <div className={primitives.kvRow}>
                  <dt>Должность / город</dt>
                  <dd>
                    {review.position || "—"} / {review.city || "—"}
                  </dd>
                </div>
              )}
              {/*
                У самоотказа строка показывается всегда — там возражение и
                есть причина отказа, и его отсутствие само по себе факт. У
                прослушки КЦ — только когда возражение записано: у звонка
                его могло не быть вовсе, и пустая строка «Возражение: —» в
                каждой карточке была бы тем самым бессмысленным «н/д»,
                которое команда просила убрать 20 августа.
              */}
              {(review.kind === "refusal" || review.objection) && (
                <div className={primitives.kvRow}>
                  <dt>Возражение</dt>
                  <dd>{review.objection || "—"}</dd>
                </div>
              )}
              {review.is_target !== null && (
                <div className={primitives.kvRow}>
                  <dt>Целевой лид</dt>
                  <dd>{review.is_target ? "Да" : "Нет"}</dd>
                </div>
              )}
              {review.outbound_calls !== null && (
                <div className={primitives.kvRow}>
                  <dt>Исходящих звонков</dt>
                  <dd>{review.outbound_calls}</dd>
                </div>
              )}
              <div className={primitives.kvRow}>
                <dt>Статус</dt>
                <dd>{STATUS_LABELS[review.status] ?? review.status}</dd>
              </div>
              <div className={primitives.kvRow}>
                <dt>Версия шаблона</dt>
                <dd className={primitives.muted}>{review.checklist_version}</dd>
              </div>
            </dl>

            {snapshot.length > 0 && (
              <div className={styles.checklist}>
                {snapshot.map((group) => (
                  <section key={group.groupId} className={styles.checklistGroup}>
                    <header className={styles.checklistGroupHead}>
                      <h4>{group.title}</h4>
                      <Badge color={scoreTone(group.percent)}>{formatPercent(group.percent)}</Badge>
                    </header>
                    <div className={styles.checklistItems}>
                      {group.items.map((item) => (
                        <div key={item.itemId} className={styles.checklistItem}>
                          <div className={styles.checklistItemTitle}>{item.title}</div>
                          <div className={primitives.muted}>{formatAnswer(item)}</div>
                        </div>
                      ))}
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

            {/*
              Команда просила «право удалять проверку, чтобы не искажала
              результат». Архив это уже делает, но по кнопке «В архив» видно
              только слово «архив» — что проверка при этом исчезает из
              отчётности, приходилось угадывать. Теперь написано.
            */}
            {canEdit("quality") && !review.archived_at && (
              <p className={styles.fieldNote}>
                Ошиблись при оценке? Уберите проверку в архив — она перестанет попадать в реестр и в сводки, а
                результат сотрудника перестанет её учитывать. Данные сохранятся, вернуть можно той же кнопкой.
              </p>
            )}
          </>
        )}
      </div>

      <footer className={styles.drawerFoot}>
        {canEdit("quality") && data && (
          <>
            {!data.review.archived_at && (
              <Button variant="primary" onClick={() => onEdit(data)}>
                Редактировать
              </Button>
            )}
            <Button danger disabled={archiving} onClick={() => void toggleArchived()}>
              {data.review.archived_at ? "Вернуть в работу" : "В архив"}
            </Button>
          </>
        )}
        <Button onClick={onClose}>Закрыть</Button>
      </footer>
    </Drawer>
  );
}
