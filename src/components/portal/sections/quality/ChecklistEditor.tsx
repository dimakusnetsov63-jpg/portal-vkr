"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Accordion, AccordionItem } from "@/components/portal/ui/Accordion";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { ErrorState, SkeletonLines } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import {
  getChecklistTree,
  QualityChecklistConflictError,
  saveChecklistTree,
} from "@/lib/supabase/qualityRepo";
import type { QualityItemScale } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import {
  addGroup,
  addItem,
  copyDraft,
  draftFromTree,
  draftToPayload,
  emptyChecklist,
  moveGroup,
  moveItem,
  removeGroup,
  removeItem,
  updateGroup,
  updateItem,
  validateChecklistDraft,
  type ChecklistDraft,
} from "./checklistDraft";
import { KIND_LABELS, QUALITY_KINDS, optionsWithCurrent, scaleValueLabel, scaleValues } from "./qualityOptions";

/**
 * Редактор шаблона: блоки и пункты.
 *
 * Устроен как черновик поверх загруженного дерева — правки копятся в
 * состоянии и уходят одним сохранением. Пошаговая запись «изменил пункт →
 * запрос» дала бы шаблон в промежуточном состоянии посреди работы, а по
 * нему в это время заполняют проверки.
 *
 * Вся логика над черновиком — в `checklistDraft.ts`, здесь только разметка
 * и вызовы. Перестановки и удаления во вложенном списке легко ломают
 * порядок или теряют `id` существующей строки, а потеря `id` не выглядит
 * ошибкой на экране: строка сохранится как новая, старая уйдёт в архив
 * вместе со ссылками из прошлых проверок.
 */

const SCALE_LABELS: Record<QualityItemScale, string> = {
  "0-1-2": "Да / Частично / Нет",
  "0-2": "Да / Нет",
  yes_no: "Переключатель блока",
};

const SCALES: QualityItemScale[] = ["0-1-2", "0-2", "yes_no"];

export function ChecklistEditor({
  checklistId,
  copyOf,
  onClose,
  onSaved,
}: {
  /** `null` — создание нового шаблона. */
  checklistId: string | null;
  /** Идентификатор шаблона-источника: дерево грузится из него, но сохранится как новое. */
  copyOf?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { listOptions, canEdit, pushToast } = usePortal();
  const editable = canEdit("quality");

  const projectOptions = useMemo(
    () => activeListOptions(listOptions, "project").map((option) => option.value),
    [listOptions],
  );

  const [draft, setDraft] = useState<ChecklistDraft>(() => emptyChecklist());
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(checklistId !== null || copyOf !== undefined);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const sourceId = checklistId ?? copyOf ?? null;

  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка дерева шаблона
    setLoading(true);
    setFailed(false);

    getChecklistTree(sourceId)
      .then((tree) => {
        if (cancelled) return;
        const loaded = draftFromTree(tree);
        // Копия: то же дерево, но без идентификаторов — сохранится как новый
        // шаблон. Название подсказывает, что это копия, чтобы два одинаковых
        // «Прослушка КЦ» не оказались в списке рядом.
        setDraft(copyOf ? copyDraft(loaded, `${loaded.title} — копия`) : loaded);
        setVersion(copyOf ? null : tree.checklist.version);
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
  }, [sourceId, copyOf]);

  const errors = useMemo(() => validateChecklistDraft(draft), [draft]);

  /**
   * Сколько пунктов и сколько блоков идут в итог — то, что важно увидеть до
   * сохранения: блок вне итога виден в проверке, но на цифру не влияет, и
   * перепутать это дорого.
   */
  const stats = useMemo(() => {
    const items = draft.groups.reduce((sum, group) => sum + group.items.length, 0);
    const counted = draft.groups.filter((group) => group.countsInTotal).length;
    return { items, counted, groups: draft.groups.length };
  }, [draft]);

  async function save() {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await saveChecklistTree(checklistId, draftToPayload(draft), version);
      pushToast(checklistId ? "Шаблон сохранён" : "Шаблон создан");
      onSaved();
    } catch (error) {
      if (error instanceof QualityChecklistConflictError) {
        pushToast(error.message, "error");
      } else {
        pushToast(error instanceof Error ? error.message : "Не удалось сохранить шаблон", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonLines lines={12} />;
  if (failed) return <ErrorState onRetry={onClose} />;

  return (
    <div className={styles.editor}>
      <div className={primitives.toolbar}>
        <Button size="sm" onClick={onClose}>
          <Icon name="chevron" size={14} />
          К списку шаблонов
        </Button>
        <div className={primitives.spacer} />
        <span className={primitives.muted}>
          {stats.groups} блоков · {stats.items} пунктов · в итог идут {stats.counted}
        </span>
        {editable && (
          <Button variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        )}
      </div>

      {showErrors && errors.length > 0 && (
        <div className={`${primitives.banner} ${primitives.bannerCritical}`}>
          <ul className={styles.errorList}>
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={primitives.fieldRow}>
        <label className={primitives.field}>
          <span>Название шаблона</span>
          <input
            value={draft.title}
            maxLength={200}
            disabled={!editable}
            placeholder="Прослушка КЦ — Газпромнефть"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label className={primitives.field}>
          <span>Вид проверки</span>
          <select
            value={draft.kind}
            disabled={!editable}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as ChecklistDraft["kind"] })}
          >
            {QUALITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className={primitives.field}>
          <span>Проект</span>
          <select
            value={draft.project}
            disabled={!editable}
            onChange={(event) => setDraft({ ...draft, project: event.target.value })}
          >
            <option value="">Все проекты (общий шаблон)</option>
            {optionsWithCurrent(projectOptions, draft.project).map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
          <span className={styles.fieldNote}>
            Проектный шаблон вытесняет общий для своего проекта. Общий остаётся для всех остальных.
          </span>
        </label>
      </div>

      <Accordion>
        {draft.groups.map((group, groupIndex) => (
          <AccordionItem
            key={group.id ?? `new-${groupIndex}`}
            defaultOpen={draft.groups.length <= 3}
            title={
              <span className={styles.groupHeading}>
                {group.title.trim() || `Блок ${groupIndex + 1}`}
                <span className={primitives.muted}>· {group.items.length} п.</span>
                {!group.countsInTotal && <Badge color="gray">не в итог</Badge>}
              </span>
            }
            headerExtra={
              editable ? (
                <>
                  <button
                    type="button"
                    className={primitives.btnIcon}
                    aria-label="Поднять блок"
                    disabled={groupIndex === 0}
                    onClick={() => setDraft(moveGroup(draft, groupIndex, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={primitives.btnIcon}
                    aria-label="Опустить блок"
                    disabled={groupIndex === draft.groups.length - 1}
                    onClick={() => setDraft(moveGroup(draft, groupIndex, 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={primitives.btnIcon}
                    aria-label="Убрать блок"
                    onClick={() => setDraft(removeGroup(draft, groupIndex))}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </>
              ) : undefined
            }
          >
            <div className={primitives.fieldRow}>
              <label className={primitives.field}>
                <span>Название блока</span>
                <input
                  value={group.title}
                  maxLength={200}
                  disabled={!editable}
                  onChange={(event) => setDraft(updateGroup(draft, groupIndex, { title: event.target.value }))}
                />
              </label>
              <label className={primitives.checkLabel}>
                <input
                  type="checkbox"
                  checked={group.countsInTotal}
                  disabled={!editable}
                  onChange={(event) =>
                    setDraft(updateGroup(draft, groupIndex, { countsInTotal: event.target.checked }))
                  }
                />
                Входит в общий итог
              </label>
            </div>

            <div className={styles.itemRows}>
              {group.items.map((item, itemIndex) => (
                <div key={item.id ?? `new-${itemIndex}`} className={styles.itemRow}>
                  <input
                    className={styles.itemTitleInput}
                    value={item.title}
                    maxLength={500}
                    disabled={!editable}
                    placeholder="Формулировка критерия"
                    onChange={(event) =>
                      setDraft(updateItem(draft, groupIndex, itemIndex, { title: event.target.value }))
                    }
                  />

                  <select
                    className={primitives.select}
                    value={item.scale}
                    disabled={!editable}
                    onChange={(event) =>
                      setDraft(updateItem(draft, groupIndex, itemIndex, { scale: event.target.value as QualityItemScale }))
                    }
                  >
                    {SCALES.map((scale) => (
                      <option key={scale} value={scale}>
                        {SCALE_LABELS[scale]}
                      </option>
                    ))}
                  </select>

                  <label className={styles.weightField}>
                    <span>вес</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={item.weight}
                      disabled={!editable || item.scale === "yes_no"}
                      onChange={(event) =>
                        setDraft(
                          updateItem(draft, groupIndex, itemIndex, { weight: Number(event.target.value) || 1 }),
                        )
                      }
                    />
                  </label>

                  {/* Переключатель баллов не даёт вовсе, поэтому ни «н/д», ни
                      «критический» к нему неприменимы — он включает и
                      выключает свой блок. */}
                  <label className={primitives.checkLabel}>
                    <input
                      type="checkbox"
                      checked={item.scale === "yes_no" ? false : item.allowNa}
                      disabled={!editable || item.scale === "yes_no"}
                      onChange={(event) =>
                        setDraft(updateItem(draft, groupIndex, itemIndex, { allowNa: event.target.checked }))
                      }
                    />
                    н/д
                  </label>

                  <label className={primitives.checkLabel} title="Ноль по этому пункту обнуляет итог всей проверки">
                    <input
                      type="checkbox"
                      checked={item.isCritical}
                      disabled={!editable || item.scale === "yes_no"}
                      onChange={(event) =>
                        setDraft(updateItem(draft, groupIndex, itemIndex, { isCritical: event.target.checked }))
                      }
                    />
                    критический
                  </label>

                  {editable && (
                    <div className={styles.itemRowActions}>
                      <button
                        type="button"
                        className={primitives.btnIcon}
                        aria-label="Поднять пункт"
                        disabled={itemIndex === 0}
                        onClick={() => setDraft(moveItem(draft, groupIndex, itemIndex, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={primitives.btnIcon}
                        aria-label="Опустить пункт"
                        disabled={itemIndex === group.items.length - 1}
                        onClick={() => setDraft(moveItem(draft, groupIndex, itemIndex, 1))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={primitives.btnIcon}
                        aria-label="Убрать пункт"
                        onClick={() => setDraft(removeItem(draft, groupIndex, itemIndex))}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  )}

                  {/* Как пункт будет выглядеть в проверке. Шкала задаётся
                      словами «Да / Частично / Нет», но увидеть настоящие
                      кнопки полезнее любого описания. */}
                  <div className={styles.itemPreview}>
                    {scaleValues(item.scale).map((value) => (
                      <span key={value} className={styles.previewChip}>
                        {scaleValueLabel(item.scale, value)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {editable && (
              <Button size="sm" onClick={() => setDraft(addItem(draft, groupIndex))}>
                <Icon name="plus" size={14} />
                Добавить пункт
              </Button>
            )}
          </AccordionItem>
        ))}
      </Accordion>

      {editable && (
        <Button onClick={() => setDraft(addGroup(draft))}>
          <Icon name="plus" size={14} />
          Добавить блок
        </Button>
      )}

      {checklistId && (
        <p className={styles.fieldNote}>
          Пункты, по которым уже выставляли оценки, при удалении уходят в архив, а не пропадают: прошлые проверки
          показывают тот состав, каким их заполняли.
        </p>
      )}
    </div>
  );
}
