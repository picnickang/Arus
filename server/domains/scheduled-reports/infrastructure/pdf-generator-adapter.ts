/**
 * PDF Generator Adapter
 * Generates PDF, CSV, and JSON reports using pdfkit
 */

import PDFDocument from "pdfkit";
import type { IPdfGeneratorAdapter } from "../domain/ports.js";
import type { ReportData, ReportFormat, ReportSection } from "../domain/types.js";

export class PdfGeneratorAdapter implements IPdfGeneratorAdapter {
  async generate(data: ReportData, format: ReportFormat): Promise<Buffer> {
    switch (format) {
      case "pdf":
        return this.generatePdf(data);
      case "csv":
        return this.generateCsv(data);
      case "json":
        return this.generateJson(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  getContentType(format: ReportFormat): string {
    switch (format) {
      case "pdf":
        return "application/pdf";
      case "csv":
        return "text/csv";
      case "json":
        return "application/json";
      default:
        return "application/octet-stream";
    }
  }

  getFileExtension(format: ReportFormat): string {
    return format;
  }

  private async generatePdf(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.renderHeader(doc, data);
      this.renderSummary(doc, data);
      this.renderSections(doc, data.sections);
      this.renderFooter(doc, data);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.fontSize(24).font("Helvetica-Bold").text(data.title, { align: "center" }).moveDown(0.5);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Generated: ${data.generatedAt.toLocaleString()}`, { align: "center" })
      .moveDown(1);

    doc.strokeColor("#cccccc").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
  }

  private renderSummary(doc: PDFKit.PDFDocument, data: ReportData): void {
    const { summary } = data;

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("Summary").moveDown(0.5);

    const summaryItems = [
      `Total Items: ${summary.totalItems}`,
      `Critical: ${summary.criticalCount}`,
      `Warnings: ${summary.warningCount}`,
      `Normal: ${summary.normalCount}`,
    ];

    doc.fontSize(10).font("Helvetica");
    summaryItems.forEach((item) => {
      doc.text(item);
    });

    if (summary.highlights.length > 0) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text("Highlights:");
      doc.font("Helvetica");
      summary.highlights.forEach((highlight) => {
        doc.text(`  - ${highlight}`);
      });
    }

    doc.moveDown(1);
  }

  private renderSections(doc: PDFKit.PDFDocument, sections: ReportSection[]): void {
    sections.forEach((section) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(section.title)
        .moveDown(0.5);

      switch (section.type) {
        case "table":
          this.renderTable(doc, section.data as Record<string, unknown>[]);
          break;
        case "text":
          this.renderText(doc, section.data);
          break;
        case "list":
          this.renderList(doc, section.data as string[]);
          break;
        default:
          doc
            .fontSize(10)
            .font("Helvetica")
            .text(JSON.stringify(section.data, null, 2));
      }

      doc.moveDown(1);
    });
  }

  private renderTable(doc: PDFKit.PDFDocument, data: Record<string, unknown>[]): void {
    if (!data || data.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").text("No data available");
      return;
    }

    const headers = Object.keys(data[0] ?? {});
    const columnWidth = 500 / Math.min(headers.length, 5);

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#333333");

    let xPos = 50;
    headers.slice(0, 5).forEach((header) => {
      doc.text(this.formatHeader(header), xPos, doc.y, {
        width: columnWidth - 5,
        ellipsis: true,
      });
      xPos += columnWidth;
    });

    doc.moveDown(0.3);

    doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    doc.fontSize(8).font("Helvetica").fillColor("#000000");

    const maxRows = 20;
    data.slice(0, maxRows).forEach((row) => {
      if (doc.y > 720) {
        doc.addPage();
      }

      const startY = doc.y;
      xPos = 50;
      headers.slice(0, 5).forEach((header) => {
        const value = this.formatValue(row[header]);
        doc.text(value, xPos, startY, {
          width: columnWidth - 5,
          ellipsis: true,
        });
        xPos += columnWidth;
      });
      doc.y = startY + 12;
    });

    if (data.length > maxRows) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Oblique").text(`... and ${data.length - maxRows} more rows`);
    }
  }

  private renderText(doc: PDFKit.PDFDocument, data: unknown): void {
    if (typeof data === "object" && data !== null) {
      doc.fontSize(10).font("Helvetica");
      Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
        doc.text(`${this.formatHeader(key)}: ${this.formatValue(value)}`);
      });
    } else {
      doc.fontSize(10).font("Helvetica").text(String(data));
    }
  }

  private renderList(doc: PDFKit.PDFDocument, items: string[]): void {
    doc.fontSize(10).font("Helvetica");
    items.forEach((item) => {
      doc.text(`  - ${item}`);
    });
  }

  private renderFooter(doc: PDFKit.PDFDocument, data: ReportData): void {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      doc
        .fontSize(8)
        .fillColor("#999999")
        .text(`Page ${i + 1} of ${pageCount} | ARUS Marine PdM`, 50, 750, {
          align: "center",
          width: 500,
        });
    }
  }

  private formatHeader(header: string): string {
    return header
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "-";
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === "number") {
      return value.toLocaleString();
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    return String(value);
  }

  private generateCsv(data: ReportData): Buffer {
    const lines: string[] = [];

    lines.push(`"${data.title}"`);
    lines.push(`"Generated: ${data.generatedAt.toISOString()}"`);
    lines.push("");

    data.sections.forEach((section) => {
      lines.push(`"${section.title}"`);

      if (section.type === "table" && Array.isArray(section.data)) {
        const tableData = section.data as Record<string, unknown>[];
        if (tableData.length > 0) {
          const headers = Object.keys(tableData[0] ?? {});
          lines.push(headers.map((h) => `"${this.formatHeader(h)}"`).join(","));

          tableData.forEach((row) => {
            const values = headers.map((h) => {
              const val = this.formatValue(row[h]);
              return `"${val.replace(/"/g, '""')}"`;
            });
            lines.push(values.join(","));
          });
        }
      }

      lines.push("");
    });

    return Buffer.from(lines.join("\n"), "utf-8");
  }

  private generateJson(data: ReportData): Buffer {
    return Buffer.from(JSON.stringify(data, null, 2), "utf-8");
  }
}
