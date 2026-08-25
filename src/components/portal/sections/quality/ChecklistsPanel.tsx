"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { listAllChecklists, setChecklistArchived } from "@/lib/supabase/qualityRepo";
import type { QualityChecklistRow } from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { ChecklistEditor } from "./ChecklistEditor";
import { checklistCoverage } from "./checklistCoverage";
import { KIND_LABELS } from "./qualityOptions";

/**
 * Список шаблонов проверки и вход в редактор.
 *
 * Отдельная вкладка, а не раздел настроек: шаблон — это содержание работы
 * контролёра, и правит его тот же человек, который проверяет звонки. Ходить
 * за этим в «Настройки» значило бы разлучить критерии с проверками, по
 * которым они применяются.
 *
 * Список грузится здесь, а не в PortalContext: он нужен одной вкладке.
 */
export function ChecklistsPanel() {
  const { canEdit, listOptions, pushToast } = usePortal();
  const editable = canEdit("quality");

  const [rows, setRows] = useState<QualityChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; copyOf?: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const projectOptions = useMemo(
    () => activeListOptions(listOptions, "project").map((option) => option.value),
    [listOptions],
  );

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    listAllChecklists()
      .then((loaded) => {
        if (!cancelled) setRows(loaded);
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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка списка шаблонов
    return load();
  }, [load]);

  const coverage = useMemo(() => checklistCoverage(rows, projectOptions), [rows, projectOptions]);

  async function toggleArchived(row: QualityChecklistRow) {
    const archived = row.archived_at === null;
    setBusyId(row.id);
    try {
      await setChecklistArchived(row.id, archived);
      pushToast(archived ? "Шаблон убран в архив" : "Шаблон возвращён в работу");
      load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Не удалось изменить состояние шаблона", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (editing) {
    return (
      <ChecklistEditor
        checklistId={editing.id}
        copyOf={editing.copyOf}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <>
      <div className={primitives.toolbar}>
        <p className={primitives.muted} style={{ margin: 0 }}>
          Шаблон подбирается по виду проверки и проекту: сначала шаблон проекта, при его отсутствии — общий.
        </p>
        <div className={primitives.spacer} />
        {editable && (
          <Button variant="primary" size="sm" onClick={() => setEditing({ id: null })}>
            <Icon name="plus" size={14} />
            Новый шаблон
          </Button>
        )}
      </div>

      {/*
        Связь «проект → шаблон» по списку шаблонов не читается: там
        перечислены шаблоны, а вопрос обратный — «по «Куперу» проверка
        вообще заполнится?». Однажды единственный общий чек-лист звонка
        переназначили на один проект, и остальные двадцать молча остались
        без шаблона; заметить это было негде.
      */}
      {!loading && !failed && (
        <div className={styles.coverage}>
          {coverage.map((kind) => (
            <p key={kind.kind}>
              <b>{KIND_LABELS[kind.kind]}:</b>{" "}
              {kind.own.length > 0 && <>свой шаблон у {kind.own.length} — {kind.own.join(", ")}. </>}
              {kind.fallback.length > 0 && <>По общему работают ещё {kind.fallback.length}. </>}
              {kind.missing.length > 0 && (
                <span className={styles.coverageMissing}>
                  Без шаблона {kind.missing.length}: {kind.missing.join(", ")} — проверку по ним не завести.
                </span>
              )}
              {kind.own.length === 0 && kind.fallback.length === 0 && kind.missing.length === 0 && "проектов нет в справочнике."}
            </p>
          ))}
        </div>
      )}

      {loading && <SkeletonRows rows={5} />}
      {!loading && failed && <ErrorState onRetry={load} />}
      {!loading && !failed && rows.length === 0 && (
        <EmptyState title="Шаблонов нет" text="Заведите первый шаблон — по нему и будут заполняться проверки." />
      )}

      {!loading && !failed && rows.length > 0 && (
        <div className={styles.checklistCards}>
          {rows.map((row) => (
            <article key={row.id} className={styles.checklistCard} data-archived={row.archived_at ? "true" : undefined}>
              <div className={styles.checklistCardMain}>
                <h4>{row.title}</h4>
                <div className={styles.checklistCardMeta}>
                  <Badge color={row.kind === "call" ? "violet" : "blue"}>
                    {KIND_LABELS[row.kind as "call" | "refusal"]}
                  </Badge>
                  {/* Общий шаблон подписан словом, а не пустотой: «—» на этом
                      месте читалось бы как «проект не заполнили». */}
                  <span className={primitives.muted}>{row.project ?? "Все проекты"}</span>
                  <span className={primitives.muted}>версия {row.version}</span>
                  {row.archived_at && <Badge color="gray">в архиве</Badge>}
                </div>
              </div>

              <div className={styles.checklistCardActions}>
                <Button size="sm" onClick={() => setEditing({ id: row.id })}>
                  {editable ? "Открыть" : "Посмотреть"}
                </Button>
                {editable && (
                  <>
                    {/* Копия — главная причина, по которой редактор вообще
                        имеет смысл: в «Прослушке КЦ» тридцать пять пунктов,
                        и проектный вариант никто не станет набирать заново. */}
                    <Button size="sm" onClick={() => setEditing({ id: null, copyOf: row.id })}>
                      Копировать
                    </Button>
                    <Button size="sm" danger disabled={busyId === row.id} onClick={() => void toggleArchived(row)}>
                      {row.archived_at ? "Вернуть" : "В архив"}
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
