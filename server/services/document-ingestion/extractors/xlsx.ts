import type { TextExtractor, SupportedFileType } from "../types";
import * as XLSX from "xlsx";
import { logger } from "../../../utils/logger";

// `xlsx` carries unfixed prototype-pollution / ReDoS advisories with no upstream
// patch (tracked in docs/SECURITY-REVIEW-FOLLOWUPS.md). This is the only path
// that parses ATTACKER-CONTROLLED spreadsheets (RAG / document ingestion), so we
// shrink the exploitable surface here: cap input size to bound ReDoS / zip-bomb
// blowup, disable formula/HTML/VBA parsing, cap sheet count, and iterate with
// own-property checks so a crafted `__proto__` sheet name cannot taint anything.
const MAX_XLSX_BYTES =
  Number.parseInt(process.env["MAX_XLSX_INGEST_BYTES"] ?? "", 10) || 25 * 1024 * 1024;
const MAX_XLSX_SHEETS = Number.parseInt(process.env["MAX_XLSX_INGEST_SHEETS"] ?? "", 10) || 256;

export const xlsxExtractor: TextExtractor = {
  supportedTypes: ["xlsx"] as SupportedFileType[],

  async extract(buffer: Buffer): Promise<string> {
    try {
      if (buffer.length > MAX_XLSX_BYTES) {
        throw new Error(
          `XLSX file too large: ${buffer.length} bytes exceeds the ${MAX_XLSX_BYTES}-byte ingestion limit`
        );
      }

      const workbook = XLSX.read(buffer, {
        type: "buffer",
        dense: true,
        cellFormula: false, // never parse/evaluate formulas from untrusted input
        cellHTML: false, // skip rich-text/HTML parsing
        sheetStubs: false,
        bookVBA: false, // do not extract macros
      });
      const textParts: string[] = [];

      const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
      let processed = 0;
      for (const sheetName of sheetNames) {
        if (typeof sheetName !== "string") {
          continue;
        }
        if (processed >= MAX_XLSX_SHEETS) {
          break;
        }
        // Own-property check guards against a malicious `__proto__`/prototype key
        // resolving to the object prototype rather than a real sheet.
        if (!Object.prototype.hasOwnProperty.call(workbook.Sheets, sheetName)) {
          continue;
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          continue;
        }
        processed += 1;
        const sheetData = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

        if (sheetData.trim()) {
          textParts.push(`## Sheet: ${sheetName}\n\n${sheetData}`);
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
