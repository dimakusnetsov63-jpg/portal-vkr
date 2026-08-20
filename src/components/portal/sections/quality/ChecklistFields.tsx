"use client";

import { Badge } from "@/components/portal/ui/Badge";
import type { QualityChecklistTree } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { answerTone, asItemScale, formatPercent, scaleValueLabel, scaleValues, scoreTone } from "./qualityOptions";
import { calculateGroupPercent, countUnanswered, type AnswerMap, type ScoreGroup } from "./qualityScore";

const ANSWER_CLASS: Record<"yes" | "partial" | "no", string> = {
  yes: styles.answerYes,
  partial: styles.answerPartial,
  no: styles.answerNo,
};

/**
 * Пункты чек-листа с проставлением баллов. Отдельный компонент, потому что
 * это единственная по-настоящему объёмная часть формы (до 40 пунктов в 9
 * блоках) и потому что она одинаково нужна и чек-листу звонка, и проверке
 * самоотказа — шаблон один и тот же, различается только его содержимое.
 *
 * Процент блока считается на каждый клик локально (`qualityScore.ts`):
 * ждать сервер, чтобы увидеть, что получилось, — ровно та работа вручную,
 * от которой уходят из таблиц. Записывается всё равно то, что посчитает
 * база при сохранении.
 */
export function ChecklistFields({
  tree,
  scoreGroups,
  answers,
  disabled,
  onChange,
}: {
  tree: QualityChecklistTree;
  scoreGroups: ScoreGroup[];
  answers: AnswerMap;
  disabled?: boolean;
  onChange: (itemId: string, value: number | null, isNa: boolean) => void;
}) {
  return (
    <div className={styles.checklist}>
      {tree.groups.map(({ group, items }) => {
        const scoreGroup = scoreGroups.find((candidate) => candidate.id === group.id);
        const percent = scoreGroup ? calculateGroupPercent(scoreGroup, answers) : null;
        const unanswered = scoreGroup ? countUnanswered(scoreGroup, answers) : 0;

        // Переключатель блока («Возражение было?») отвечает за весь блок:
        // при «Нет» остальные пункты не заполняются и не считаются.
        const gate = items.find((item) => item.scale === "yes_no");
        const gateClosed = gate ? answers[gate.id]?.value === 0 : false;

        return (
          <section key={group.id} className={styles.checklistGroup}>
            <header className={styles.checklistGroupHead}>
              <h4>
                {group.title}
                {!group.counts_in_total && <span className={styles.groupNote}>не входит в итог</span>}
              </h4>
              <div className={styles.groupScore}>
                {unanswered > 0 && <span className={primitives.muted}>осталось {unanswered}</span>}
                <Badge color={scoreTone(percent)}>{formatPercent(percent)}</Badge>
              </div>
            </header>

            <div className={styles.checklistItems}>
              {items.map((item) => {
                const answer = answers[item.id];
                const isGate = item.scale === "yes_no";
                const locked = disabled || (gateClosed && !isGate);

                return (
                  <div key={item.id} className={styles.checklistItem} data-locked={locked || undefined}>
                    <div className={styles.checklistItemTitle}>
                      {item.title}
                      {item.is_critical && <span className={styles.criticalNote}>критический</span>}
                    </div>

                    <div className={styles.checklistItemControls}>
                      <div className={primitives.seg}>
                        {scaleValues(asItemScale(item.scale)).map((value) => {
                          const selected = Boolean(answer) && !answer?.isNa && answer?.value === value;
                          // Выбранный ответ красится по смыслу: зелёный «да»,
                          // охра «частично», красный «нет». Общий
                          // `segButtonActive` отмечает выбор сменой фона на
                          // полтона — на сорока пунктах подряд этого не видно.
                          const tone = selected ? ANSWER_CLASS[answerTone(asItemScale(item.scale), value)] : "";

                          return (
                            <button
                              key={value}
                              type="button"
                              disabled={locked}
                              aria-pressed={selected}
                              className={`${primitives.segButton} ${selected ? primitives.segButtonActive : ""} ${tone}`}
                              onClick={() => onChange(item.id, value, false)}
                            >
                              {scaleValueLabel(asItemScale(item.scale), value)}
                            </button>
                          );
                        })}
                      </div>

                      {item.allow_na && !isGate && (
                        <label className={primitives.checkLabel}>
                          <input
                            type="checkbox"
                            checked={answer?.isNa ?? false}
                            disabled={locked}
                            onChange={(event) => onChange(item.id, null, event.target.checked)}
                          />
                          н/д
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
