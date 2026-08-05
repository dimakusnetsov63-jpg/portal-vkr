import ExcelJS from "exceljs";

/** Reads an .xlsx/.xls file (from a browser File or a Buffer) into an ExcelJS workbook — the only place in the import module touching exceljs directly. */
export async function readWorkbook(source: File | Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  await workbook.xlsx.load(buffer as ArrayBuffer);
  return workbook;
}
