import type ExcelJS from "exceljs";
import { cellDate, cellText } from "../excel/cellValue";
import type { RawImportRow } from "../validateRow";
import type { RowError } from "../types";
import { isYes, normalizeMetro, normalizeScheduleType, normalizeShiftType } from "../mapping/normalizeConditions";
import type { DemandParser } from "./DemandParser";

/**
 * Первый полностью поддерживаемый проект — «Лавка». Реальная выгрузка
 * (МСК_31.07.xlsx) не плоская таблица «город/адрес/должность/дата/
 * потребность» (как ожидает `genericColumnParser.ts`) — это экспорт
 * тикетов из Yandex Tracker, один тикет = одна вакантная позиция на одной
 * площадке. Из него по-настоящему считаются три вещи, которых нет
 * отдельными колонками:
 *
 * - **Город и адрес** склеены в колонку «Задача»:
 *   "Москва | Вакансия Кладовщик для площадки: МСК Щелковское шоссе, 21 А | 2023102403"
 *   — до первого " | " — город; между "площадки:" и последним " | <код>" —
 *   адрес площадки.
 * - **Потребность.** Колонка «Количество вакансий» в реальном файле всегда
 *   пуста (проверено на всей выгрузке) — потребность здесь считается как
 *   1 открытая позиция на тикет, а не читается из несуществующего числа.
 *   Несколько тикетов на одном адресе/должности/дате суммируются позже в
 *   `importDemand.ts` (шаг `aggregateDuplicateKeys`) — иначе upsert с
 *   повторяющимся ключом внутри одного запроса упал бы ошибкой Postgres
 *   `ON CONFLICT DO UPDATE command cannot affect row a second time`.
 * - **Дата потребности.** В файле нет отдельной колонки с датой, на которую
 *   нужен человек — используется дата колонки «Обновлено» (последняя
 *   актуализация тикета). Это осознанное допущение источника данных, а не
 *   самой единой модели — см. известные ограничения в
 *   `docs/requirements/addresses.md`.
 * - **Статус.** Учитываются только тикеты не в статусе «Закрыт» (закрытый
 *   тикет — позиция уже не нужна). На реальном файле 1930 из 2091 строк —
 *   «Закрыт»; без этого фильтра импорт создал бы потребность на давно
 *   заполненные позиции.
 *
 * Должность надёжнее брать из отдельной колонки «Теги», а не парсить из
 * «Задачи» — там она склеена со словом «Вакансия» тем же текстом без
 * чёткого разделителя от адреса при некоторых форматах площадки.
 *
 * Помимо потребности выгрузка несёт **условия работы на объекте**, которые
 * ложатся на существующие поля карточки адреса: «Метро» → `metro`,
 * «График» → `schedule_type`, «Ночной формат работы» → `shift_type`,
 * «Разгрузка» → чекбокс в `features`. Эти колонки необязательные: если их
 * нет, карточка создастся с пустыми полями, а не отклонится. Приведение
 * значений к тому, что допускает схема, — в `mapping/normalizeConditions.ts`
 * (в реальном файле один и тот же график записан 29 способами).
 *
 * project_import_configs.column_mapping для parser_key='lavka_v1':
 * {"task": "Задача", "position": "Теги", "demand": "Количество вакансий",
 *  "date": "Обновлено", "status": "Статус", "metro": "Метро",
 *  "schedule": "График", "nightShift": "Ночной формат работы",
 *  "unloading": "Разгрузка"}.
 */

// Не заякорено на "последний токен = только код заявки" — реальные строки
// иногда несут после кода произвольный хвост («2025082701 (бронь ООО
// Виста) 17.07»), поэтому граница адреса — последний " | " в строке, а не
// последнее одно слово.
const TASK_PATTERN = /^(.+?)\s*\|.*?площадки:\s*(.+)\s*\|[^|]*$/u;
const REQUIRED_FIELDS = ["task", "position", "demand", "date", "status"] as const;
/**
 * Колонки «условий работы». Необязательные: если проект пришлёт выгрузку без
 * них, импорт по-прежнему создаст карточки — просто с пустыми полями, а не
 * упадёт на проверке формата.
 */
const OPTIONAL_FIELDS = ["metro", "schedule", "nightShift", "unloading"] as const;
const CLOSED_STATUS = "Закрыт";

/** `DemandParser` for project «Лавка» — see the module doc comment above for the full extraction logic and its assumptions. */
export const parserLavkaV1: DemandParser = {
  parserKey: "lavka_v1",

  canParse(workbook, config) {
    const sheet = workbook.worksheets[0];
    if (!sheet) return false;
    const headers = headerIndex(sheet.getRow(1));
    return REQUIRED_FIELDS.every((field) => headers.has(config[field]));
  },

  extractRows(workbook, config, project) {
    const sheet = workbook.worksheets[0];
    if (!sheet) return { rows: [], errors: [{ rowNumber: 0, reason: "В файле нет ни одного листа" }] };

    const headers = headerIndex(sheet.getRow(1));
    const columnIndex: Record<string, number> = {};
    for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
      const configured = config[field];
      if (!configured) continue;
      const colNumber = headers.get(configured);
      if (colNumber !== undefined) columnIndex[field] = colNumber;
    }

    const missing = REQUIRED_FIELDS.filter((field) => columnIndex[field] === undefined);
    if (missing.length > 0) {
      return {
        rows: [],
        errors: [
          { rowNumber: 1, reason: `Отсутствуют обязательные столбцы: ${missing.map((f) => config[f]).join(", ")}` },
        ],
      };
    }

    const rows: RawImportRow[] = [];
    const errors: RowError[] = [];
    const lastRow = sheet.rowCount;
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const taskText = cellText(row.getCell(columnIndex.task).value);
      if (!taskText) continue; // пустая строка листа — не ошибка импорта

      const status = cellText(row.getCell(columnIndex.status).value);
      if (status === CLOSED_STATUS) continue; // закрытый тикет — позиция уже не актуальна, не потребность

      const match = TASK_PATTERN.exec(taskText);
      if (!match) {
        errors.push({ rowNumber, reason: `Не удалось разобрать город и адрес площадки из «Задачи»: «${taskText}»` });
        continue;
      }
      const [, city, address] = match;
      const trimmedAddress = address.trim();

      const demandText = cellText(row.getCell(columnIndex.demand).value);
      const optional = (field: (typeof OPTIONAL_FIELDS)[number]) =>
        columnIndex[field] === undefined ? "" : cellText(row.getCell(columnIndex[field]).value);

      rows.push({
        rowNumber,
        project,
        city,
        address: trimmedAddress,
        position: cellText(row.getCell(columnIndex.position).value),
        date: cellDate(row.getCell(columnIndex.date).value),
        // "Количество вакансий" в реальном файле не заполняется — один тикет = одна открытая позиция.
        demand: demandText || "1",
        conditions: {
          metro: normalizeMetro(optional("metro")),
          scheduleType: normalizeScheduleType(optional("schedule")),
          shiftType: normalizeShiftType(optional("nightShift")),
          features: isYes(optional("unloading")) ? ["unloading"] : [],
        },
      });
    }

    return { rows, errors };
  },
};

function headerIndex(headerRow: ExcelJS.Row): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    index.set(cellText(cell.value), colNumber);
  });
  return index;
}
