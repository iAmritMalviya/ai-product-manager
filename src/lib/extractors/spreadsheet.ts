import * as XLSX from "xlsx";
import { logger } from "../logger.js";

const log = logger.child({ module: "extractor:spreadsheet" });
const MAX_ROWS = 100;

export function extractFromSpreadsheet(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const cappedRows = rows.slice(0, MAX_ROWS);

    lines.push(`Sheet: ${sheetName}`);

    for (let i = 0; i < cappedRows.length; i++) {
      const row = cappedRows[i];
      const pairs = Object.entries(row)
        .map(([key, val]) => `${key}=${String(val ?? "")}`)
        .join(", ");
      if (pairs) {
        lines.push(`Row ${i + 1}: ${pairs}`);
      }
    }

    if (rows.length > MAX_ROWS) {
      lines.push(`... (${rows.length - MAX_ROWS} more rows truncated)`);
    }
  }

  const text = lines.join("\n");
  log.info({ sheets: workbook.SheetNames.length, textLength: text.length }, "Spreadsheet extracted");
  return text;
}
