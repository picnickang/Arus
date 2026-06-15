import type { TextExtractor, SupportedFileType } from "../types";
import ExcelJS from "exceljs";
import { logger } from "../../../utils/logger";

// We use `exceljs` instead of the `xlsx` package, which shipped unfixed
// prototype-pollution / ReDoS advisories with no upstream patch (tracked in
// docs/SECURITY-REVIEW-FOLLOWUPS.md). This is the only path that parses
// ATTACKER-CONTROLLED spreadsheets (RAG / document ingestion), so we still
// bound the surface: cap input size to limit ReDoS / zip-bomb blowup, cap the
// sheet count, and extract only cached cell values — exceljs never evaluates
// formulas, and we read a formula cell's cached `result`, never its expression.
const MAX_XLSX_BYTES =
  Number.parseInt(process.env["MAX_XLSX_INGEST_BYTES"] ?? "", 10) || 25 * 1024 * 1024;
const MAX_XLSX_SHEETS = Number.parseInt(process.env["MAX_XLSX_INGEST_SHEETS"] ?? "", 10) || 256;

function csvField(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const xlsxExtractor: TextExtractor = {
  supportedTypes: ["xlsx"] as SupportedFileType[],

  async extract(buffer: Buffer): Promise<string> {
    try {
      if (buffer.length > MAX_XLSX_BYTES) {
        throw new Error(
          `XLSX file too large: ${buffer.length} bytes exceeds the ${MAX_XLSX_BYTES}-byte ingestion limit`
        );
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const textParts: string[] = [];
      let processed = 0;
      for (const sheet of workbook.worksheets) {
        if (processed >= MAX_XLSX_SHEETS) {
          break;
        }
        processed += 1;

        const lines: string[] = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const cells: string[] = [];
          // `cell.text` is the cell's display text: a formula cell yields its
          // cached result (never the formula expression), and rich-text /
          // hyperlink / date cells yield their rendered text.
          row.eachCell({ includeEmpty: true }, (cell) => {
            cells.push(csvField(cell.text ?? ""));
          });
          const line = cells.join(",");
          // blankrows:false equivalent — skip rows with no real content.
          if (line.replace(/,/g, "").trim()) {
            lines.push(line);
          }
        });

        const sheetData = lines.join("\n");
        if (sheetData.trim()) {
          textParts.push(`## Sheet: ${sheet.name}\n\n${sheetData}`);
        }
      }

      const text = textParts.join("\n\n---\n\n");

      if (!text.trim()) {
        throw new Error("XLSX file contains no extractable text content");
      }

      return text.trim();
    } catch (error) {
      logger.error("XlsxExtractor", "Failed to extract text from XLSX", { error });
      throw new Error(
        `XLSX extraction failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
