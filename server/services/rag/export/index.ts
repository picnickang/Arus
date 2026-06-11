/**
 * RAG Export Service
 * Exports conversations to PDF and Markdown formats
 */

import PDFDocument from "pdfkit";

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  citations?: Array<{
    documentId: string;
    documentTitle: string;
    excerpt: string;
  }>;
}

export interface ExportConversation {
  id: string;
  title: string;
  createdAt: Date;
  messages: Array<
    Omit<ExportMessage, "citations"> & { citations?: ExportMessage["citations"] | undefined }
  >;
}

export interface ExportOptions {
  format: "pdf" | "markdown";
  includeCitations: boolean;
  includeTimestamps: boolean;
  headerText?: string | undefined;
  footerText?: string | undefined;
}

const DEFAULT_OPTIONS: ExportOptions = {
  format: "markdown",
  includeCitations: true,
  includeTimestamps: true,
};

export class ExportService {
  async exportConversation(
    conversation: ExportConversation,
    options: Partial<ExportOptions> = {}
  ): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.format === "pdf") {
      return this.exportToPDF(conversation, opts);
    }
    return this.exportToMarkdown(conversation, opts);
  }

  private async exportToMarkdown(
    conversation: ExportConversation,
    options: ExportOptions
  ): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    const lines: string[] = [];

    lines.push(`# ${conversation.title}`);
    lines.push("");
    lines.push(`**Conversation ID:** ${conversation.id}`);
    lines.push(`**Created:** ${conversation.createdAt.toISOString()}`);
    lines.push(`**Messages:** ${conversation.messages.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const message of conversation.messages) {
      const roleLabel = message.role === "user" ? "You" : "Assistant";
      const icon = message.role === "user" ? ">" : "";

      if (options.includeTimestamps) {
        lines.push(`### ${roleLabel} - ${message.timestamp.toLocaleString()}`);
      } else {
        lines.push(`### ${roleLabel}`);
      }
      lines.push("");

      if (icon) {
        lines.push(`${icon} ${message.content}`);
      } else {
        lines.push(message.content);
      }
      lines.push("");

      if (options.includeCitations && message.citations && message.citations.length > 0) {
        lines.push("**Sources:**");
        for (const citation of message.citations) {
          lines.push(`- [${citation.documentTitle}] ${citation.excerpt.substring(0, 100)}...`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }

    if (options.footerText) {
      lines.push("");
      lines.push(`*${options.footerText}*`);
    }

    const content = lines.join("\n");
    const filename = this.sanitizeFilename(`${conversation.title}-export.md`);

    return {
      data: Buffer.from(content, "utf-8"),
      mimeType: "text/markdown",
      filename,
    };
  }

  private async exportToPDF(
    conversation: ExportConversation,
    options: ExportOptions
  ): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const data = Buffer.concat(chunks);
        const filename = this.sanitizeFilename(`${conversation.title}-export.pdf`);
        resolve({
          data,
          mimeType: "application/pdf",
          filename,
        });
      });
      doc.on("error", reject);

      doc.fontSize(20).font("Helvetica-Bold").text(conversation.title, { align: "center" });

      doc.moveDown();

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666666")
        .text(`Conversation ID: ${conversation.id}`, { align: "center" })
        .text(`Created: ${conversation.createdAt.toLocaleString()}`, { align: "center" })
        .text(`Messages: ${conversation.messages.length}`, { align: "center" });

      doc.moveDown(2);

      doc.strokeColor("#cccccc").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();

      doc.moveDown();

      for (const message of conversation.messages) {
        const roleLabel = message.role === "user" ? "You" : "Assistant";
        const roleColor = message.role === "user" ? "#2563eb" : "#059669";

        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor(roleColor)
          .text(roleLabel, { continued: options.includeTimestamps });

        if (options.includeTimestamps) {
          doc
            .font("Helvetica")
            .fillColor("#999999")
            .fontSize(9)
            .text(` - ${message.timestamp.toLocaleString()}`);
        }

        doc.moveDown(0.5);

        doc.fontSize(11).font("Helvetica").fillColor("#333333").text(message.content, {
          align: "left",
          lineGap: 2,
        });

        if (options.includeCitations && message.citations && message.citations.length > 0) {
          doc.moveDown(0.5);
          doc.fontSize(9).font("Helvetica-Oblique").fillColor("#666666").text("Sources:");

          for (const citation of message.citations) {
            doc.text(`  - ${citation.documentTitle}`, {
              indent: 10,
            });
          }
        }

        doc.moveDown();

        doc.strokeColor("#eeeeee").lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();

        doc.moveDown();

        if (doc.y > 700) {
          doc.addPage();
        }
      }

      if (options.footerText) {
        doc.moveDown(2);
        doc
          .fontSize(9)
          .font("Helvetica-Oblique")
          .fillColor("#999999")
          .text(options.footerText, { align: "center" });
      }

      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor("#999999")
          .text(`Page ${i + 1} of ${pageCount}`, 50, 780, {
            align: "center",
            width: 495,
          });
      }

      doc.end();
    });
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9\-_.]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 100);
  }

  getSupportedFormats(): string[] {
    return ["pdf", "markdown"];
  }
}

export const exportService = new ExportService();
