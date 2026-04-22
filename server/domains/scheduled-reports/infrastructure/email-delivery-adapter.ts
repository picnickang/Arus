/**
 * Email Delivery Adapter
 * Delivers reports via the existing email notification system
 */

import type { IReportDeliveryAdapter } from "../domain/ports.js";
import type { GeneratedReport } from "../domain/types.js";
import { emailSender } from "../../../services/email-notification/email-sender.js";
import { logger } from "../../../utils/logger.js";

const LOG_CTX = "EmailDeliveryAdapter";

export class EmailDeliveryAdapter implements IReportDeliveryAdapter {
  async deliver(
    report: GeneratedReport,
    recipients: string[],
    content: Buffer
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subject = this.buildSubject(report);
      const { text, html } = this.buildBody(report);

      const attachment = {
        filename: report.filename,
        content,
        contentType: this.getContentType(report.format),
      };

      for (const recipient of recipients) {
        await emailSender.sendWithAttachment(recipient, subject, text, html, attachment);

        logger.info(LOG_CTX, `Report delivered to ${recipient}`, report.id);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LOG_CTX, `Failed to deliver report ${report.id}`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private buildSubject(report: GeneratedReport): string {
    const typeLabels: Record<string, string> = {
      fleet_health: "Fleet Health Summary",
      maintenance_due: "Maintenance Due Report",
      inventory_status: "Inventory Status Report",
      crew_compliance: "Crew Compliance Report",
      cost_summary: "Cost Summary Report",
    };

    const label = typeLabels[report.reportType] || "Report";
    const date = report.generatedAt.toLocaleDateString();
    return `[ARUS] ${label} - ${date}`;
  }

  private buildBody(report: GeneratedReport): { text: string; html: string } {
    const date = report.generatedAt.toLocaleString();

    const text = `
ARUS Scheduled Report

Your scheduled ${this.formatReportType(report.reportType)} has been generated.

Report Details:
- Type: ${this.formatReportType(report.reportType)}
- Format: ${report.format.toUpperCase()}
- Generated: ${date}

Please find the report attached to this email.

---
This is an automated message from ARUS Marine PdM.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .label { font-weight: bold; color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ARUS Marine PdM</h1>
      <p>Scheduled Report</p>
    </div>
    <div class="content">
      <p>Your scheduled <strong>${this.formatReportType(report.reportType)}</strong> has been generated.</p>
      
      <div class="details">
        <p><span class="label">Type:</span> ${this.formatReportType(report.reportType)}</p>
        <p><span class="label">Format:</span> ${report.format.toUpperCase()}</p>
        <p><span class="label">Generated:</span> ${date}</p>
        <p><span class="label">File Size:</span> ${this.formatFileSize(report.fileSize)}</p>
      </div>
      
      <p>Please find the report attached to this email.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from ARUS Marine PdM.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { text, html };
  }

  private formatReportType(type: string): string {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private getContentType(format: string): string {
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
}
