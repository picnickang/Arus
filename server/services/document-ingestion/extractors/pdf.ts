import type { TextExtractor, SupportedFileType } from "../types";

interface TableData {
  rows: string[][];
  headerRow?: string[];
}

interface EnhancedExtractionResult {
  text: string;
  tables: TableData[];
  pageCount: number;
  structuredSections: string[];
}

export class PdfExtractor implements TextExtractor {
  supportedTypes: SupportedFileType[] = ["pdf"];

  async extract(buffer: Buffer): Promise<string> {
    const result = await this.extractEnhanced(buffer);
    return result.text;
  }

  async extractEnhanced(buffer: Buffer): Promise<EnhancedExtractionResult> {
    try {
      const pdfParseModule = await import("pdf-parse");
      let rawText = "";
      let pageCount = 0;

      if (pdfParseModule.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const result = await parser.getText();
        rawText = result.pages?.map((p: { text: string }) => p.text).join("\n") || "";
        pageCount = result.pages?.length || 0;
        await parser.destroy();
      } else {
        const pdfParse = pdfParseModule.default;
        if (typeof pdfParse === "function") {
          const data = await pdfParse(buffer);
          rawText = data.text || "";
          pageCount = data.numpages || 0;
        } else {
          throw new Error("No compatible PDF parser found");
        }
      }

      const tables = this.detectTables(rawText);
      const structuredSections = this.detectStructuredSections(rawText);
      const enhancedText = this.enhanceTextWithTableMarkers(rawText, tables);

      return {
        text: enhancedText,
        tables,
        pageCount,
        structuredSections,
      };
    } catch (error) {
      console.error("[DocIngestion:PDF] Parsing failed:", error);
      throw new Error(
        `PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private detectTables(text: string): TableData[] {
    const tables: TableData[] = [];
    const lines = text.split("\n");

    let currentTable: string[][] = [];
    let inTable = false;
    let columnSeparatorPattern: RegExp | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const isTableLine = this.isLikelyTableRow(line);

      if (isTableLine && !inTable) {
        inTable = true;
        currentTable = [];
        columnSeparatorPattern = this.detectColumnSeparator(line);
      }

      if (inTable) {
        if (!isTableLine && currentTable.length > 0) {
          if (currentTable.length >= 2) {
            tables.push({
              rows: currentTable,
              headerRow: currentTable[0],
            });
          }
          currentTable = [];
          inTable = false;
          columnSeparatorPattern = null;
        } else if (isTableLine) {
          const cells = this.parseTableRow(line, columnSeparatorPattern);
          if (cells.length > 1) {
            currentTable.push(cells);
          }
        }
      }
    }

    if (currentTable.length >= 2) {
      tables.push({
        rows: currentTable,
        headerRow: currentTable[0],
      });
    }

    return tables;
  }

  private isLikelyTableRow(line: string): boolean {
    if (line.length < 5) {
      return false;
    }

    const tabCount = (line.match(/\t/g) || []).length;
    if (tabCount >= 2) {
      return true;
    }

    const pipeCount = (line.match(/\|/g) || []).length;
    if (pipeCount >= 2) {
      return true;
    }

    const multiSpaceSegments = line.split(/\s{3,}/);
    if (multiSpaceSegments.length >= 3) {
      return true;
    }

    const colonPattern = /^[A-Za-z\s]+:\s+.+/;
    if (colonPattern.test(line)) {
      return false;
    }

    return false;
  }

  private detectColumnSeparator(line: string): RegExp {
    if (line.includes("\t")) {
      return /\t+/;
    }
    if (line.includes("|")) {
      return /\s*\|\s*/;
    }
    return /\s{3,}/;
  }

  private parseTableRow(line: string, separator: RegExp | null): string[] {
    const sep = separator || /\s{3,}/;
    return line
      .split(sep)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
  }

  private detectStructuredSections(text: string): string[] {
    const sections: string[] = [];
    const lines = text.split("\n");

    const sectionPatterns = [
      /^(?:chapter|section|part)\s+\d+[.:]?\s*/i,
      /^\d+\.\d*\s+[A-Z]/,
      /^[A-Z][A-Z\s]{10,}$/,
      /^(?:introduction|conclusion|summary|abstract|references|appendix)/i,
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      for (const pattern of sectionPatterns) {
        if (pattern.test(trimmed)) {
          sections.push(trimmed);
          break;
        }
      }
    }

    return sections;
  }

  private enhanceTextWithTableMarkers(text: string, tables: TableData[]): string {
    if (tables.length === 0) {
      return text;
    }

    let enhancedText = text;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const header = table.headerRow?.join(" | ") || "";
      const tableMarker = `\n[TABLE ${i + 1}: ${header}]\n`;

      const tableContent = table.rows.map((row) => row.join(" | ")).join("\n");

      if (header && enhancedText.includes(header.split(" | ")[0])) {
        enhancedText = enhancedText.replace(
          tableContent,
          `${tableMarker}${tableContent}\n[END TABLE ${i + 1}]\n`
        );
      }
    }

    return enhancedText;
  }

  formatTableAsText(table: TableData): string {
    const lines: string[] = [];

    if (table.headerRow) {
      lines.push(`| ${table.headerRow.join(" | ")} |`);
      lines.push(`| ${table.headerRow.map(() => "---").join(" | ")} |`);
    }

    for (const row of table.rows.slice(table.headerRow ? 1 : 0)) {
      lines.push(`| ${row.join(" | ")} |`);
    }

    return lines.join("\n");
  }
}

export const pdfExtractor = new PdfExtractor();
