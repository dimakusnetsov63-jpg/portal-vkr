"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Modal } from "@/components/portal/ui/Modal";
import modal from "@/components/portal/ui/Modal.module.css";
import primitives from "@/components/portal/ui/primitives.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { importDemand } from "@/lib/imports/importDemand";
import type { ImportMode, ImportPreviewAction, ImportPreviewRow, ImportReport } from "@/lib/imports/types";

const MODE_HINTS: Record<ImportMode, string> = {
  replace: "«Требуется» у совпавших объектов будет перезаписано числом из файла. Объекты, которых в файле нет, останутся как есть.",
  add: "Число из файла прибавится к текущему «Требуется» совпавших объектов. Объекты, которых в файле нет, останутся как есть.",
  sync:
    "Как «Заменить», но дополнительно обнулит «Требуется» у объектов проекта, которых в файле нет — выгрузка показывает только открытые позиции, поэтому укомплектованный объект из неё исчезает. Карточки, заведённые вручную, не затрагиваются. Файл должен покрывать проект целиком: если он только по одному городу, объекты остальных городов обнулятся.",
};

/**
 * 3-шаговая загрузка потребности из Excel: выбор проекта+файла → предпросмотр
 * (с обязательной проверкой "Проверить" перед реальным импортом) → финальный
 * отчёт. Парсер и маппинг колонок определяются project_import_configs на
 * сервере (importDemand.ts) — эта модалка не знает, какой именно парсер
 * используется.
 */
export function ImportDemandModal({ onClose }: { onClose: () => void }) {
  const { pushToast, listOptions, currentUser, refreshAddresses } = usePortal();
  const [project, setProject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);

  const projectOptions = activeListOptions(listOptions, "project").map((o) => o.value);
  const knownCities = activeListOptions(listOptions, "city").map((o) => o.value);
  const knownPositions = activeListOptions(listOptions, "position").map((o) => o.value);

  async function runImport(dryRun: boolean) {
    if (!project || !file) return;
    setBusy(dryRun ? "check" : "import");
    try {
      const result = await importDemand({
        project,
        file,
        mode,
        dryRun,
        knownCities,
        knownPositions,
        actor: { id: currentUser.id, login: currentUser.login },
      });
      setReport(result);
      if (dryRun) {
        pushToast("Проверка завершена — данные не записаны в базу");
      } else {
        pushToast("Импорт завершён");
        // Импорт создаёт/обновляет карточки в public.addresses — перечитываем
        // список, чтобы новые объекты появились в таблице без перезагрузки
        // страницы.
        await refreshAddresses();
      }
    } catch (e) {
      pushToast(toErrorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const step = report ? "report" : "upload";

  return (
    <Modal open onClose={onClose} title="Загрузить потребность" wide>
      {step === "upload" && (
        <>
          <div className={primitives.fieldRow}>
            <div className={primitives.field}>
              <label>Проект</label>
              <Combobox
                value={project}
                onChange={(v) => {
                  setProject(v);
                  setFile(null);
                }}
                options={projectOptions}
              />
            </div>
            <div className={primitives.field}>
              <label>Файл (.xlsx, .xls)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={!project}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <span className={modal.modalNote}>{file.name}</span>}
            </div>
          </div>

          <div className={primitives.field}>
            <label>Режим импорта</label>
            <div className={`${primitives.pillTabs} ${primitives.pillTabsInline}`}>
              <button
                className={`${primitives.pillTabButton} ${mode === "replace" ? primitives.pillTabButtonActive : ""}`}
                onClick={() => setMode("replace")}
              >
                Заменить
              </button>
              <button
                className={`${primitives.pillTabButton} ${mode === "add" ? primitives.pillTabButtonActive : ""}`}
                onClick={() => setMode("add")}
              >
                Добавить
              </button>
              <button
                className={`${primitives.pillTabButton} ${mode === "sync" ? primitives.pillTabButtonActive : ""}`}
                onClick={() => setMode("sync")}
              >
                Синхронизировать
              </button>
            </div>
          </div>

          <p className={modal.modalNote}>{MODE_HINTS[mode]}</p>

          <p className={modal.modalNote}>
            Формат каждого проекта определяется в Настройках. Нажмите «Проверить» — данные будут разобраны и
            провалидированы, но не записаны в базу; это можно повторять сколько угодно раз перед реальной загрузкой.
          </p>

          <div className={modal.modalFoot}>
            <Button onClick={onClose}>Отмена</Button>
            <Button disabled={!project || !file || busy !== null} onClick={() => runImport(true)}>
              {busy === "check" ? "Проверка…" : "Проверить"}
            </Button>
            <Button variant="primary" disabled={!project || !file || busy !== null} onClick={() => runImport(false)}>
              {busy === "import" ? "Импорт…" : "Импортировать"}
            </Button>
          </div>
        </>
      )}

      {step === "report" && report && <ImportReportView report={report} onBack={() => setReport(null)} onClose={onClose} />}
    </Modal>
  );
}

function ImportReportView({ report, onBack, onClose }: { report: ImportReport; onBack: () => void; onClose: () => void }) {
  return (
    <>
      <div className={primitives.fieldRow}>
        <Stat label="Всего строк" value={report.totalRows} />
        <Stat label="Обработано строк" value={report.importedRows} />
        <Stat label="Ошибок" value={report.errorRows} />
        <Stat label="Новых адресов" value={report.newRows} />
        <Stat label="Обновлено адресов" value={report.updatedRows} />
        {report.mode === "sync" && <Stat label="Обнулено адресов" value={report.zeroedRows} />}
        <Stat label="Время" value={`${(report.durationMs / 1000).toFixed(1)} с`} />
      </div>

      {report.dryRun && <p className={modal.modalNote}>Это проверка — данные не записаны в базу.</p>}

      {report.warnings.map((warning) => (
        <p className={modal.modalNote} key={warning}>
          {warning}
        </p>
      ))}

      {report.preview.length > 0 && <PreviewTable rows={report.preview} />}

      {report.errors.length > 0 && (
        <div className={primitives.tableWrap}>
          <table className={primitives.table}>
            <thead>
              <tr>
                <th>Строка</th>
                <th>Причина</th>
              </tr>
            </thead>
            <tbody>
              {report.errors.map((e) => (
                <tr key={e.rowNumber}>
                  <td>{e.rowNumber}</td>
                  <td>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={modal.modalFoot}>
        <Button onClick={onBack}>{report.dryRun ? "Назад" : "Загрузить ещё файл"}</Button>
        <Button variant="primary" onClick={onClose}>
          Готово
        </Button>
      </div>
    </>
  );
}

const ACTION_LABELS: Record<ImportPreviewAction, string> = {
  create: "Новый",
  update: "Обновление",
  zero: "Обнуление",
};

/** Что именно запишется в «Адреса» — не только счётчики, но и сами объекты: город/должность/адрес и «было → станет». ТЗ §5 требует такой предпросмотр, а не только итоги. */
function PreviewTable({ rows }: { rows: ImportPreviewRow[] }) {
  return (
    <div className={primitives.tableWrap}>
      <div className={primitives.tableScroll}>
        <table className={primitives.table}>
          <thead>
            <tr>
              <th>Действие</th>
              <th>Город</th>
              <th>Должность</th>
              <th>Адрес</th>
              <th>Было</th>
              <th>Станет</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.city}-${row.position}-${row.address}-${i}`}>
                <td>{ACTION_LABELS[row.action]}</td>
                <td>{row.city}</td>
                <td>{row.position}</td>
                <td>{row.address}</td>
                <td>{row.previousRequired ?? "—"}</td>
                <td>{row.required}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={primitives.field}>
      <label>{label}</label>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Supabase-js throws a plain `{message, code, details}` object, not an
 * `Error` instance — a bare `e instanceof Error` check silently swallowed
 * the real reason (missing table, RLS denial, etc.) behind a generic
 * fallback. This also covers the real `Error`s importDemand.ts throws
 * itself (unknown parser, no config for the project, wrong file format).
 */
function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Не удалось обработать файл";
}
