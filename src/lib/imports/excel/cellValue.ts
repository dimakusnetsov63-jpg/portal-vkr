import type ExcelJS from "exceljs";

/** Cell text, trimmed. Handles exceljs's hyperlink cell shape ({text, hyperlink}) by taking `.text`, since Excel exports of Tracker-style tickets (see parser_lavka.ts) render the ticket key as a link. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value && typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
  return String(value ?? "").trim();
}

/** Cell value formatted as an ISO "YYYY-MM-DD" date string — exceljs returns a JS Date for date/datetime cells. Falls back to the raw cell text for anything else (validateRow's own date parsing decides if that text is acceptable). */
export function cellDate(value: ExcelJS.CellValue): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return cellText(value);
}
