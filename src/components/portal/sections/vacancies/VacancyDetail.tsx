"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Accordion } from "@/components/portal/ui/Accordion";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Icon, type IconName } from "@/components/portal/ui/Icon";
import { ErrorState, SkeletonLines } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { fmtDateTime } from "@/lib/portal/format";
import {
  getVacancyProjectTree,
  saveVacancyProjectTree,
  VacancyVersionConflictError,
} from "@/lib/supabase/vacancyProjectsRepo";
import type {
  VacancyAttachmentDraft,
  VacancyFieldDraft,
  VacancyFieldType,
  VacancyProjectTree,
  VacancyProjectTreeDraft,
  VacancySectionDraft,
} from "@/lib/supabase/vacancyProjects.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { VacancyAttachmentsList } from "./VacancyAttachmentsList";
import { VacancyHistoryPanel } from "./VacancyHistoryPanel";
import { VacancySectionCard } from "./VacancySectionCard";
import { guessSectionIcon, VACANCY_SECTION_SUGGESTIONS } from "./vacancyOptions";
import { buildDraftFromTree, reorderFields, reorderSections, sectionHasVisibleContent, sectionMatchesQuery } from "./vacancyTreeDraft";
import styles from "./VacancyDetail.module.css";

export function VacancyDetail({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const {
    pushToast,
    listOptions,
    refreshVacancyProjects,
    archiveVacancyProjectRecord,
    restoreVacancyProjectRecord,
    duplicateVacancyProjectRecord,
  } = usePortal();

  const [tree, setTree] = useState<VacancyProjectTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VacancyProjectTreeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [showArchivedSections, setShowArchivedSections] = useState(false);

  const categoryOptions = activeListOptions(listOptions, "vacancy_category");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTree(await getVacancyProjectTree(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить вакансию");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local edit state when the selected vacancy changes
    setEditing(false);
    setDraft(null);
    setVersionConflict(false);
    setSearch("");
    setOpenSections(new Set());
    load();
  }, [load]);

  function startEdit() {
    if (!tree) return;
    setDraft(buildDraftFromTree(tree));
    setEditing(true);
    setVersionConflict(false);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function handleSave() {
    if (!draft || !tree) return;
    setSaving(true);
    try {
      await saveVacancyProjectTree(projectId, tree.project.version, draft);
      await Promise.all([load(), refreshVacancyProjects()]);
      setEditing(false);
      setDraft(null);
      pushToast("Изменения сохранены");
    } catch (e) {
      if (e instanceof VacancyVersionConflictError) {
        setVersionConflict(true);
        pushToast(e.message, "error");
      } else {
        pushToast(e instanceof Error ? e.message : "Не удалось сохранить изменения", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReloadAfterConflict() {
    setVersionConflict(false);
    setEditing(false);
    setDraft(null);
    await load();
  }

  function updateDraft(fn: (d: VacancyProjectTreeDraft) => VacancyProjectTreeDraft) {
    setDraft((d) => (d ? fn(d) : d));
  }

  function addSection(title: string, icon: string) {
    updateDraft((d) => ({
      ...d,
      sections: [
        ...d.sections,
        { id: null, title, icon, is_system: false, sort_order: d.sections.length, archived_at: null, fields: [], attachments: [] },
      ],
    }));
  }

  function patchSection(index: number, patch: Partial<VacancySectionDraft>) {
    updateDraft((d) => {
      const sections = [...d.sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...d, sections };
    });
  }

  function addField(sectionIndex: number, fieldType: VacancyFieldType) {
    updateDraft((d) => {
      const sections = [...d.sections];
      const fields = [
        ...sections[sectionIndex].fields,
        { id: null, label: "", value: "", field_type: fieldType, sort_order: sections[sectionIndex].fields.length },
      ];
      sections[sectionIndex] = { ...sections[sectionIndex], fields };
      return { ...d, sections };
    });
  }

  function patchField(sectionIndex: number, fieldIndex: number, patch: Partial<VacancyFieldDraft>) {
    updateDraft((d) => {
      const sections = [...d.sections];
      const fields = [...sections[sectionIndex].fields];
      fields[fieldIndex] = { ...fields[fieldIndex], ...patch };
      sections[sectionIndex] = { ...sections[sectionIndex], fields };
      return { ...d, sections };
    });
  }

  function removeField(sectionIndex: number, fieldIndex: number) {
    updateDraft((d) => {
      const sections = [...d.sections];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        fields: sections[sectionIndex].fields.filter((_, i) => i !== fieldIndex),
      };
      return { ...d, sections };
    });
  }

  function addAttachment(sectionIndex: number | null, attachment: Omit<VacancyAttachmentDraft, "id" | "sort_order">) {
    updateDraft((d) => {
      if (sectionIndex === null) {
        return { ...d, attachments: [...d.attachments, { ...attachment, id: null, sort_order: d.attachments.length }] };
      }
      const sections = [...d.sections];
      const attachments = [
        ...sections[sectionIndex].attachments,
        { ...attachment, id: null, sort_order: sections[sectionIndex].attachments.length },
      ];
      sections[sectionIndex] = { ...sections[sectionIndex], attachments };
      return { ...d, sections };
    });
  }

  function removeAttachment(sectionIndex: number | null, attachmentIndex: number) {
    updateDraft((d) => {
      if (sectionIndex === null) {
        return { ...d, attachments: d.attachments.filter((_, i) => i !== attachmentIndex) };
      }
      const sections = [...d.sections];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        attachments: sections[sectionIndex].attachments.filter((_, i) => i !== attachmentIndex),
      };
      return { ...d, sections };
    });
  }

  function scrollToSection(sectionKey: string) {
    document.getElementById(`vacancy-section-${sectionKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return <SkeletonLines lines={8} />;
  }
  if (error || !tree) {
    return <ErrorState onRetry={load} />;
  }

  const displaySections: VacancySectionDraft[] = editing && draft ? draft.sections : tree.sections;
  const displayGeneralAttachments: VacancyAttachmentDraft[] = editing && draft ? draft.attachments : tree.generalAttachments;

  const entries = displaySections.map((section, index) => ({ section, index }));
  const visibleEntries = entries.filter(
    (e) => !e.section.archived_at && (editing || sectionHasVisibleContent(tree.sections[e.index])),
  );
  const archivedEntries = entries.filter((e) => e.section.archived_at);

  const canSave = editing && !saving;

  return (
    <div className={styles.detail}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          {editing && draft ? (
            <input
              className={styles.titleInput}
              type="text"
              value={draft.title}
              onChange={(e) => updateDraft((d) => ({ ...d, title: e.target.value }))}
            />
          ) : (
            <h3 className={styles.title}>{tree.project.title}</h3>
          )}
          <div className={styles.headMeta}>
            {editing && draft ? (
              <select
                className={styles.categorySelect}
                value={draft.category_option_id ?? ""}
                onChange={(e) => updateDraft((d) => ({ ...d, category_option_id: e.target.value || null }))}
              >
                <option value="">Без категории</option>
                {categoryOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.value}
                  </option>
                ))}
              </select>
            ) : (
              tree.project.category_option && <Badge color="blue">{tree.project.category_option.value}</Badge>
            )}
            {tree.project.archived_at && <Badge color="gray">В архиве</Badge>}
            <span className={styles.updatedMeta}>
              изменено {fmtDateTime(new Date(tree.project.updated_at))}
              {tree.project.updated_by_login ? ` • ${tree.project.updated_by_login}` : ""}
            </span>
          </div>
        </div>

        <div className={styles.headActions}>
          <button
            type="button"
            className={`${primitives.btnIcon} ${primitives.btnIconSm}`}
            onClick={() => setHistoryOpen(true)}
            aria-label="История изменений"
            title="История изменений"
          >
            <Icon name="clock" size={16} />
          </button>
          {canEdit && !editing && (
            <>
              <Button size="sm" onClick={startEdit}>
                <Icon name="pencil" size={14} />
                Редактировать
              </Button>
              <Button size="sm" onClick={() => duplicateVacancyProjectRecord(projectId)}>
                <Icon name="download" size={14} />
                Дублировать
              </Button>
              {tree.project.archived_at ? (
                <Button size="sm" onClick={() => restoreVacancyProjectRecord(projectId)}>
                  Восстановить
                </Button>
              ) : (
                <Button size="sm" onClick={() => archiveVacancyProjectRecord(projectId)}>
                  Архивировать
                </Button>
              )}
            </>
          )}
          {canEdit && editing && (
            <>
              <Button size="sm" onClick={cancelEdit} disabled={saving}>
                Отменить
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </>
          )}
        </div>
      </div>

      {versionConflict && (
        <div className={styles.conflictBanner}>
          <Icon name="alert" size={16} />
          <span>Кто-то уже изменил эту вакансию. Обновите данные, чтобы продолжить.</span>
          <Button size="sm" onClick={handleReloadAfterConflict}>
            Обновить данные
          </Button>
        </div>
      )}

      <div className={`${primitives.searchField} ${styles.inPageSearch}`}>
        <Icon name="search" size={14} />
        <input
          type="text"
          placeholder="Найти внутри вакансии…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <nav className={styles.anchorNav}>
          {visibleEntries.map(({ section, index }) => (
            <button
              key={section.id ?? `new-${index}`}
              type="button"
              className={styles.anchorItem}
              onClick={() => scrollToSection(section.id ?? section.title)}
            >
              {section.icon && <Icon name={section.icon as IconName} size={14} />}
              {section.title}
            </button>
          ))}
          {editing && (
            <div className={styles.addSectionRow}>
              <select
                className={styles.addSectionSelect}
                value=""
                onChange={(e) => {
                  const suggestion = VACANCY_SECTION_SUGGESTIONS.find((s) => s.title === e.target.value);
                  if (suggestion) addSection(suggestion.title, suggestion.icon);
                }}
              >
                <option value="">+ Добавить раздел…</option>
                {VACANCY_SECTION_SUGGESTIONS.map((s) => (
                  <option key={s.title} value={s.title}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.addSectionCustom}
                onClick={() => {
                  const title = window.prompt("Название раздела");
                  if (title?.trim()) addSection(title.trim(), guessSectionIcon(title.trim()));
                }}
              >
                <Icon name="plus" size={12} />
                Свой раздел
              </button>
            </div>
          )}
        </nav>

        <div className={styles.content}>
          <VacancyAttachmentsList
            attachments={displayGeneralAttachments}
            editing={editing}
            onAdd={(a) => addAttachment(null, a)}
            onRemove={(i) => removeAttachment(null, i)}
          />

          <Accordion>
            {visibleEntries.map(({ section, index }) => (
              <VacancySectionCard
                key={section.id ?? `new-${index}`}
                section={section}
                editing={editing}
                open={openSections.has(index) || (search.trim() !== "" && sectionMatchesQuery(section, search))}
                onToggleOpen={(open) =>
                  setOpenSections((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(index);
                    else next.delete(index);
                    return next;
                  })
                }
                highlightQuery={search}
                onTitleChange={(title) => patchSection(index, { title })}
                onArchive={() => patchSection(index, { archived_at: new Date().toISOString() })}
                onMoveUp={() => setDraft((d) => (d ? reorderSections(d, index, "up") : d))}
                onMoveDown={() => setDraft((d) => (d ? reorderSections(d, index, "down") : d))}
                canMoveUp={index > 0}
                canMoveDown={index < displaySections.length - 1}
                onFieldChange={(fieldIndex, patch) => patchField(index, fieldIndex, patch)}
                onFieldRemove={(fieldIndex) => removeField(index, fieldIndex)}
                onFieldMoveUp={(fieldIndex) => setDraft((d) => (d ? reorderFields(d, index, fieldIndex, "up") : d))}
                onFieldMoveDown={(fieldIndex) => setDraft((d) => (d ? reorderFields(d, index, fieldIndex, "down") : d))}
                onAddField={() => addField(index, "text")}
                onAttachmentAdd={(a) => addAttachment(index, a)}
                onAttachmentRemove={(i) => removeAttachment(index, i)}
              />
            ))}
          </Accordion>

          {editing && archivedEntries.length > 0 && (
            <div className={styles.archivedSections}>
              <button type="button" onClick={() => setShowArchivedSections((v) => !v)}>
                Архивные разделы ({archivedEntries.length})
              </button>
              {showArchivedSections && (
                <ul>
                  {archivedEntries.map(({ section, index }) => (
                    <li key={section.id ?? `archived-${index}`}>
                      <span>{section.title}</span>
                      <Button size="sm" onClick={() => patchSection(index, { archived_at: null })}>
                        Восстановить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {historyOpen && <VacancyHistoryPanel projectId={projectId} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
