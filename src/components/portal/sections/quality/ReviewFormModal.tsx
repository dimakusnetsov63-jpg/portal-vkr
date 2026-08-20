"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Modal } from "@/components/portal/ui/Modal";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { fmtDate } from "@/lib/portal/format";
import {
  getChecklistTree,
  findReviewsByLead,
  pickChecklist,
  QualityVersionConflictError,
  saveReview,
  type SaveReviewInput,
} from "@/lib/supabase/qualityRepo";
import type {
  QualityChecklistRow,
  QualityChecklistTree,
  QualityKind,
  QualityReviewWithScores,
} from "@/lib/supabase/quality.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./QualitySection.module.css";
import { ChecklistFields } from "./ChecklistFields";
import { CALL_TYPES, CALL_TYPE_LABELS, KIND_LABELS, QUALITY_KINDS, formatPercent, leadUrl, scoreTone } from "./qualityOptions";
import { calculateReviewScore, countUnanswered, parseLeadId, type AnswerMap, type ScoreGroup } from "./qualityScore";
import { todayIso } from "./qualityFilters";
import { validateReviewForm } from "./reviewForm";

interface FormState {
  kind: QualityKind;
  project: string;
  leadInput: string;
  employeeName: string;
  reviewDate: string;
  callDate: string;
  callType: string;
  position: string;
  city: string;
  objection: string;
  crmComment: string;
  handlingSpeed: string;
  outboundCalls: string;
  isTarget: string;
  violation: string;
  recommendations: string;
  isCase: boolean;
  caseComment: string;
}

/**
 * Задержка перед поиском прошлых проверок лида. Достаточно, чтобы дописать
 * номер до конца, и незаметно на глаз.
 */
const LEAD_LOOKUP_DELAY_MS = 400;

function emptyForm(project: string): FormState {
  return {
    kind: "call",
    project,
    leadInput: "",
    employeeName: "",
    // Дата по местному времени, а не через toISOString: у пользователя
    // восточнее Гринвича проверка, заведённая после полуночи, получала
    // вчерашнюю дату (BUG-07 аудита).
    reviewDate: todayIso(),
    callDate: "",
    callType: "",
    position: "",
    city: "",
    objection: "",
    crmComment: "",
    handlingSpeed: "",
    outboundCalls: "",
    isTarget: "",
    violation: "",
    recommendations: "",
    isCase: false,
    caseComment: "",
  };
}

/**
 * Форма проверки: шапка (лид, сотрудник, обстоятельства звонка) плюс пункты
 * шаблона. Открывается и на создание, и на правку — форма одна, потому что
 * набор полей одинаков, а «посмотреть, не меняя» делает карточка.
 */
export function ReviewFormModal({
  checklists,
  existing,
  onClose,
  onSaved,
}: {
  checklists: QualityChecklistRow[];
  existing?: QualityReviewWithScores | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { listOptions, pushToast, currentUser } = usePortal();

  const projectOptions = useMemo(
    () => activeListOptions(listOptions, "project").map((option) => option.value),
    [listOptions],
  );
  const positionOptions = useMemo(
    () => activeListOptions(listOptions, "position").map((option) => option.value),
    [listOptions],
  );
  const cityOptions = useMemo(() => activeListOptions(listOptions, "city").map((option) => option.value), [listOptions]);
  const objectionOptions = useMemo(
    () => activeListOptions(listOptions, "qc_objection").map((option) => option.value),
    [listOptions],
  );
  // Сотрудники КЦ — тот же справочник, что «Рекрутер» у кандидатов: это
  // одни и те же люди, отдельного списка раздел не заводит (B4 аудита).
  const employeeOptions = useMemo(
    () => activeListOptions(listOptions, "recruiter").map((option) => option.value),
    [listOptions],
  );
  const violationOptions = useMemo(
    () => activeListOptions(listOptions, "qc_violation").map((option) => option.value),
    [listOptions],
  );

  const [form, setForm] = useState<FormState>(() => {
    if (!existing) return emptyForm(projectOptions[0] ?? "");
    const review = existing.review;
    return {
      kind: review.kind as QualityKind,
      project: review.project,
      leadInput: String(review.crm_lead_id),
      employeeName: review.employee_name,
      reviewDate: review.review_date,
      callDate: review.call_date ?? "",
      callType: review.call_type ?? "",
      position: review.position ?? "",
      city: review.city ?? "",
      objection: review.objection ?? "",
      crmComment: review.crm_comment ?? "",
      handlingSpeed: review.handling_speed ?? "",
      outboundCalls: review.outbound_calls === null ? "" : String(review.outbound_calls),
      isTarget: review.is_target === null ? "" : String(review.is_target),
      violation: review.violation ?? "",
      recommendations: review.recommendations ?? "",
      isCase: review.is_case,
      caseComment: review.case_comment ?? "",
    };
  });

  const [tree, setTree] = useState<QualityChecklistTree | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (!existing) return {};
    const initial: AnswerMap = {};
    for (const score of existing.scores) {
      initial[score.item_id] = { value: score.value, isNa: score.is_na };
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateNote, setDuplicateNote] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const checklist = useMemo(
    () =>
      existing
        ? (checklists.find((item) => item.id === existing.review.checklist_id) ?? null)
        : pickChecklist(checklists, form.kind, form.project),
    [checklists, existing, form.kind, form.project],
  );

  // Дерево шаблона грузится отдельно от списка шаблонов: у одного чек-листа
  // до 40 пунктов, тянуть их для всех девяти шаблонов сразу незачем.
  useEffect(() => {
    if (!checklist) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс шаблона при смене проекта/вида
      setTree(null);
      return;
    }
    let cancelled = false;
    setTreeLoading(true);
    getChecklistTree(checklist.id)
      .then((loaded) => {
        if (!cancelled) setTree(loaded);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить шаблон");
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checklist]);

  const scoreGroups = useMemo<ScoreGroup[]>(
    () =>
      (tree?.groups ?? []).map(({ group, items }) => ({
        id: group.id,
        countsInTotal: group.counts_in_total,
        items: items.map((item) => ({
          id: item.id,
          scale: item.scale as ScoreGroup["items"][number]["scale"],
          weight: item.weight,
          isCritical: item.is_critical,
        })),
      })),
    [tree],
  );

  const score = useMemo(() => calculateReviewScore(scoreGroups, answers), [scoreGroups, answers]);

  /**
   * Сколько пунктов осталось без ответа. Завершить проверку с пропусками
   * нельзя: процент считается по отвеченным пунктам, поэтому три удачных
   * ответа из тридцати пяти дали бы 100%. Отвергает такое сохранение база
   * (`portal_save_quality_review`), здесь — чтобы человек увидел это до
   * нажатия, а не в виде ошибки после.
   */
  const unanswered = useMemo(
    () => scoreGroups.reduce((sum, group) => sum + countUnanswered(group, answers), 0),
    [scoreGroups, answers],
  );

  const leadId = parseLeadId(form.leadInput);

  // Предупреждение о повторной проверке лида. Не запрет: в рабочих таблицах
  // повторные проверки встречаются и бывают осмысленными — проверяющий
  // должен просто знать, что она не первая.
  useEffect(() => {
    if (leadId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс подсказки о повторной проверке
      setDuplicateNote(null);
      return;
    }
    let cancelled = false;

    // Пауза перед запросом: `leadId` пересчитывается на каждый символ, и без
    // неё ввод семизначного номера отправлял бы семь запросов подряд — шесть
    // из них про заведомо неполный номер (TD-04 аудита).
    const timer = setTimeout(() => {
      findReviewsByLead(leadId, existing?.review.id)
        .then((found) => {
          if (cancelled) return;
          const previous = found[0];
          setDuplicateNote(
            previous
              ? `Этот лид уже проверяли ${fmtDate(new Date(previous.review_date))}, ${previous.reviewer_name}, итог ${formatPercent(previous.total_score)}.`
              : null,
          );
        })
        .catch(() => {
          // Молча: подсказка полезная, но её отсутствие не должно мешать
          // заполнять проверку.
          if (!cancelled) setDuplicateNote(null);
        });
    }, LEAD_LOOKUP_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [leadId, existing?.review.id]);

  const changeAnswer = useCallback((itemId: string, value: number | null, isNa: boolean) => {
    setAnswers((prev) => ({ ...prev, [itemId]: { value, isNa } }));
  }, []);

  async function submit(status: "draft" | "completed") {
    const validation = validateReviewForm(
      {
        project: form.project,
        leadInput: form.leadInput,
        employeeName: form.employeeName,
        outboundCalls: form.outboundCalls,
      },
      { hasChecklist: Boolean(checklist && tree), unanswered, status },
    );

    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    if (!checklist) return;

    const payload: SaveReviewInput = {
      reviewId: existing?.review.id ?? null,
      expectedVersion: existing?.review.version ?? null,
      checklistId: checklist.id,
      kind: form.kind,
      crmLeadId: validation.leadId,
      project: form.project,
      employeeName: validation.employeeName,
      reviewerName: currentUser.full_name || currentUser.login,
      reviewDate: form.reviewDate || null,
      callDate: form.callDate || null,
      callType: form.callType || null,
      position: form.position || null,
      city: form.city || null,
      objection: form.objection || null,
      crmComment: form.crmComment || null,
      handlingSpeed: form.handlingSpeed || null,
      outboundCalls: form.outboundCalls === "" ? null : Number(form.outboundCalls),
      isTarget: form.isTarget === "" ? null : form.isTarget === "true",
      violation: form.violation || null,
      recommendations: form.recommendations || null,
      isCase: form.isCase,
      caseComment: form.caseComment || null,
      status,
      answers: Object.entries(answers).map(([itemId, answer]) => ({
        itemId,
        value: answer?.value ?? null,
        isNa: answer?.isNa ?? false,
      })),
    };

    setSaving(true);
    setError(null);
    try {
      const saved = await saveReview(payload);
      pushToast(
        status === "draft"
          ? "Черновик сохранён"
          : `Проверка сохранена, итог ${formatPercent(saved.total_score ?? null)}`,
      );
      onSaved();
      onClose();
    } catch (saveError) {
      // Конфликт версий — не обычная ошибка: правку нельзя повторить
      // вслепую, данные нужно перечитать. Тот же приём, что у вакансий.
      if (saveError instanceof QualityVersionConflictError) {
        setError(`${saveError.message} Закройте форму и откройте проверку заново.`);
      } else {
        setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить проверку");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={existing ? "Проверка качества" : "Новая проверка"}
      footer={
        <>
          <div className={styles.formTotal}>
            Итог: <Badge color={scoreTone(score.total)}>{formatPercent(score.total)}</Badge>
            {score.hasCritical && <span className={styles.criticalNote}>критическая ошибка</span>}
            {unanswered > 0 && <span className={primitives.muted}>не заполнено пунктов: {unanswered}</span>}
          </div>
          <div className={primitives.spacer} />
          <Button onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void submit("draft")} disabled={saving}>
            Сохранить черновик
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit("completed")}
            disabled={saving || unanswered > 0}
            title={unanswered > 0 ? "Заполните все пункты или сохраните черновик" : undefined}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </>
      }
    >
      {error && <div className={`${primitives.banner} ${primitives.bannerCritical}`}>{error}</div>}

      <div className={primitives.fieldRow}>
        <label className={primitives.field}>
          <span>Вид проверки</span>
          <select
            value={form.kind}
            disabled={Boolean(existing)}
            onChange={(event) => setField("kind", event.target.value as QualityKind)}
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
          <select value={form.project} onChange={(event) => setField("project", event.target.value)}>
            <option value="">—</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>

        <label className={primitives.field}>
          <span>Лид (номер или ссылка)</span>
          <input
            value={form.leadInput}
            maxLength={200}
            placeholder="3660718"
            onChange={(event) => setField("leadInput", event.target.value)}
          />
        </label>

        <label className={primitives.field}>
          <span>Сотрудник</span>
          {/*
            Combobox, а не свободный input: по этому полю группируется вся
            отчётность раздела, и опечатка расщепляет статистику человека на
            двух разных людей. Список — общий справочник «Рекрутеры»
            (candidate_list_options), тот же, что у кандидатов. Свободный
            ввод при этом остаётся: новый сотрудник не должен упираться в
            то, что его ещё не завели в Настройках. Пробелы схлопывает база.
          */}
          <Combobox
            value={form.employeeName}
            onChange={(value) => setField("employeeName", value)}
            options={employeeOptions}
            placeholder="Фамилия Имя"
            emptyHint="Список пуст — добавьте сотрудников в Настройки → Списки → Рекрутеры."
          />
        </label>
      </div>

      {leadId !== null && (
        <p className={primitives.muted}>
          <a href={leadUrl(leadId)} target="_blank" rel="noreferrer">
            Открыть лид {leadId} в CRM
          </a>
        </p>
      )}
      {duplicateNote && <div className={primitives.banner}>{duplicateNote}</div>}

      <div className={primitives.fieldRow}>
        <label className={primitives.field}>
          <span>Дата проверки</span>
          <input type="date" value={form.reviewDate} onChange={(event) => setField("reviewDate", event.target.value)} />
        </label>
        <label className={primitives.field}>
          <span>Дата звонка</span>
          <input type="date" value={form.callDate} onChange={(event) => setField("callDate", event.target.value)} />
        </label>
        <label className={primitives.field}>
          <span>Тип звонка</span>
          <select value={form.callType} onChange={(event) => setField("callType", event.target.value)}>
            <option value="">—</option>
            {CALL_TYPES.map((type) => (
              <option key={type} value={type}>
                {CALL_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className={primitives.field}>
          <span>Должность</span>
          <select value={form.position} onChange={(event) => setField("position", event.target.value)}>
            <option value="">—</option>
            {positionOptions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>
        <label className={primitives.field}>
          <span>Город</span>
          <select value={form.city} onChange={(event) => setField("city", event.target.value)}>
            <option value="">—</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </div>

      {form.kind === "refusal" && (
        <div className={primitives.fieldRow}>
          <label className={primitives.field}>
            <span>Возражение кандидата</span>
            <select value={form.objection} onChange={(event) => setField("objection", event.target.value)}>
              <option value="">—</option>
              {objectionOptions.map((objection) => (
                <option key={objection} value={objection}>
                  {objection}
                </option>
              ))}
            </select>
          </label>
          <label className={primitives.field}>
            <span>Целевой лид</span>
            <select value={form.isTarget} onChange={(event) => setField("isTarget", event.target.value)}>
              <option value="">—</option>
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
          </label>
          <label className={primitives.field}>
            <span>Скорость обработки</span>
            <input
              maxLength={200}
              value={form.handlingSpeed}
              onChange={(event) => setField("handlingSpeed", event.target.value)}
            />
          </label>
          <label className={primitives.field}>
            <span>Исходящих звонков</span>
            <input
              type="number"
              min={0}
              value={form.outboundCalls}
              onChange={(event) => setField("outboundCalls", event.target.value)}
            />
          </label>
        </div>
      )}

      {form.kind === "refusal" && (
        <label className={primitives.field}>
          <span>Комментарий рекрутёра в CRM</span>
          <textarea
            rows={2}
            maxLength={4000}
            value={form.crmComment}
            onChange={(event) => setField("crmComment", event.target.value)}
          />
        </label>
      )}

      {treeLoading && <SkeletonLines lines={8} />}

      {!treeLoading && !checklist && (
        <div className={`${primitives.banner} ${primitives.bannerCritical}`}>
          Для проекта «{form.project || "—"}» нет шаблона «{KIND_LABELS[form.kind]}». Заведите его в разделе шаблонов
          или выберите другой проект.
        </div>
      )}

      {!treeLoading && tree && (
        <ChecklistFields
          tree={tree}
          scoreGroups={scoreGroups}
          answers={answers}
          onChange={changeAnswer}
        />
      )}

      <div className={primitives.fieldRow}>
        <label className={primitives.field}>
          <span>Нарушение</span>
          <select value={form.violation} onChange={(event) => setField("violation", event.target.value)}>
            <option value="">—</option>
            {violationOptions.map((violation) => (
              <option key={violation} value={violation}>
                {violation}
              </option>
            ))}
          </select>
        </label>
        <label className={primitives.checkLabel}>
          <input type="checkbox" checked={form.isCase} onChange={(event) => setField("isCase", event.target.checked)} />
          Кейс в аудиотеку
        </label>
      </div>

      <label className={primitives.field}>
        <span>Рекомендации и комментарии</span>
        <textarea
          rows={3}
          maxLength={4000}
          value={form.recommendations}
          onChange={(event) => setField("recommendations", event.target.value)}
        />
      </label>

      {form.isCase && (
        <label className={primitives.field}>
          <span>Почему это кейс</span>
          <textarea
            rows={2}
            maxLength={4000}
            value={form.caseComment}
            onChange={(event) => setField("caseComment", event.target.value)}
          />
        </label>
      )}
    </Modal>
  );
}
