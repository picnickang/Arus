// @ts-nocheck
/**
 * Email Templates Service
 * Manages customizable email templates for Purchase Orders and Service Orders
 */

import { alertSettingsRepository } from "./settings-repository";
import { logger } from "../../utils/logger.js";

export interface EmailTemplate {
  subject: string;
  body: string;
  enabled: boolean;
}

export interface EmailTemplatesPublic {
  purchaseOrder: EmailTemplate;
  serviceOrder: EmailTemplate;
}

export interface EmailTemplatePlaceholder {
  key: string;
  description: string;
  example: string;
}

export const PO_PLACEHOLDERS: EmailTemplatePlaceholder[] = [
  { key: "{{orderNumber}}", description: "Purchase Order number", example: "PO-2025-0001" },
  { key: "{{supplierName}}", description: "Supplier company name", example: "Marine Parts Ltd" },
  { key: "{{requestNumber}}", description: "Purchase Request reference", example: "PR-2025-0001" },
  { key: "{{requiredByDate}}", description: "Required delivery date", example: "Jan 15, 2025" },
  {
    key: "{{itemsTable}}",
    description: "HTML table of ordered items",
    example: "<table>...</table>",
  },
  {
    key: "{{quotationRequestBox}}",
    description: "Pricing request box",
    example: "<div>Please provide...</div>",
  },
];

export const SO_PLACEHOLDERS: EmailTemplatePlaceholder[] = [
  { key: "{{soNumber}}", description: "Service Order number", example: "SO-2025-0001" },
  {
    key: "{{serviceProviderName}}",
    description: "Service provider name",
    example: "Marine Services Co",
  },
  { key: "{{vesselName}}", description: "Vessel name", example: "MV Pacific Star" },
  { key: "{{equipmentName}}", description: "Equipment being serviced", example: "Main Engine" },
  { key: "{{workOrderNumber}}", description: "Related work order", example: "WO-2025-0001" },
  { key: "{{scheduleInfo}}", description: "Schedule dates", example: "Jan 10 - Jan 15, 2025" },
  { key: "{{durationInfo}}", description: "Estimated duration", example: "8 hours" },
  {
    key: "{{scopeOfWork}}",
    description: "Scope of work description",
    example: "Engine overhaul...",
  },
  {
    key: "{{specialRequirements}}",
    description: "Special requirements",
    example: "Crane access required",
  },
  {
    key: "{{quotationRequestBox}}",
    description: "Pricing request box (if no quote)",
    example: "<div>Please provide...</div>",
  },
];

const DEFAULT_PO_SUBJECT = "Purchase Order: {{orderNumber}}";
const DEFAULT_PO_BODY = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Purchase Order: {{orderNumber}}</h2>
  <p>Dear {{supplierName}},</p>
  <p>Please find below the details for Purchase Order <strong>{{orderNumber}}</strong> 
     (Reference: {{requestNumber}}).</p>
  
  {{requiredByDate}}
  
  {{itemsTable}}
  
  {{quotationRequestBox}}
  
  <p>Please confirm receipt of this order and provide expected delivery dates along with your pricing.</p>
  <p>Best regards,<br>ARUS Procurement System</p>
</body>
</html>`;

const DEFAULT_SO_SUBJECT = "Service Order: {{soNumber}}";
const DEFAULT_SO_BODY = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb;">Service Order: {{soNumber}}</h2>
  <p>Dear {{serviceProviderName}},</p>
  <p>Please find below the details for Service Order <strong>{{soNumber}}</strong>.</p>
  
  <div style="margin: 20px 0; padding: 16px; background: #f5f5f5; border-radius: 8px;">
    {{vesselName}}
    {{equipmentName}}
    {{workOrderNumber}}
    {{scheduleInfo}}
    {{durationInfo}}
  </div>
  
  {{scopeOfWork}}
  {{specialRequirements}}
  {{quotationRequestBox}}
  
  <p style="margin-top: 24px;">Please confirm receipt of this service order and provide availability confirmation.</p>
  <p>Best regards,<br><strong>ARUS Maritime Operations</strong></p>
</body>
</html>`;

function log(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown> = {}
) {
  const contextStr = Object.entries(context)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" ");

  if (level === "error") {
    logger.error("EmailTemplates", message, contextStr || undefined);
  } else if (level === "warn") {
    logger.warn("EmailTemplates", message, contextStr || undefined);
  } else {
    logger.info("EmailTemplates", message, contextStr || undefined);
  }
}

export class EmailTemplatesService {
  getDefaultTemplates(): EmailTemplatesPublic {
    return {
      purchaseOrder: {
        subject: DEFAULT_PO_SUBJECT,
        body: DEFAULT_PO_BODY,
        enabled: true,
      },
      serviceOrder: {
        subject: DEFAULT_SO_SUBJECT,
        body: DEFAULT_SO_BODY,
        enabled: true,
      },
    };
  }

  async getTemplates(orgId: string): Promise<EmailTemplatesPublic> {
    const settings = await alertSettingsRepository.getOrgSettings(orgId);
    const defaults = this.getDefaultTemplates();

    if (!settings) {
      return defaults;
    }

    return {
      purchaseOrder: settings.purchaseOrderEmailTemplate ?? defaults.purchaseOrder,
      serviceOrder: settings.serviceOrderEmailTemplate ?? defaults.serviceOrder,
    };
  }

  async updateTemplates(
    orgId: string,
    data: Partial<EmailTemplatesPublic>
  ): Promise<EmailTemplatesPublic> {
    const updateData: Record<string, EmailTemplate | undefined> = {};

    if (data.purchaseOrder) {
      updateData.purchaseOrderEmailTemplate = data.purchaseOrder;
    }
    if (data.serviceOrder) {
      updateData.serviceOrderEmailTemplate = data.serviceOrder;
    }

    await alertSettingsRepository.upsertOrgSettings(orgId, updateData);
    log("info", "Email templates updated", { orgId });

    return this.getTemplates(orgId);
  }

  async resetTemplate(
    orgId: string,
    type: "purchaseOrder" | "serviceOrder"
  ): Promise<EmailTemplatesPublic> {
    const defaults = this.getDefaultTemplates();
    const updateData: Record<string, EmailTemplate> = {};

    if (type === "purchaseOrder") {
      updateData.purchaseOrderEmailTemplate = defaults.purchaseOrder;
    } else {
      updateData.serviceOrderEmailTemplate = defaults.serviceOrder;
    }

    await alertSettingsRepository.upsertOrgSettings(orgId, updateData);
    log("info", "Email template reset to default", { orgId, type });

    return this.getTemplates(orgId);
  }

  getPlaceholders(): {
    purchaseOrder: EmailTemplatePlaceholder[];
    serviceOrder: EmailTemplatePlaceholder[];
  } {
    return {
      purchaseOrder: PO_PLACEHOLDERS,
      serviceOrder: SO_PLACEHOLDERS,
    };
  }

  renderTemplate(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value || "");
    }
    return result;
  }

  generatePreview(
    template: EmailTemplate,
    type: "purchaseOrder" | "serviceOrder"
  ): { subject: string; body: string } {
    const sampleData =
      type === "purchaseOrder"
        ? {
            orderNumber: "PO-2025-0001",
            supplierName: "Marine Parts Ltd",
            requestNumber: "PR-2025-0001",
            requiredByDate: "<p><strong>Required By:</strong> Jan 15, 2025</p>",
            itemsTable: `<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <thead><tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd;">Part Number</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Description</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Quantity</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Unit Price</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">P-001</td><td style="padding: 8px; border: 1px solid #ddd;">Oil Filter</td><td style="padding: 8px; border: 1px solid #ddd;">10</td><td style="padding: 8px; border: 1px solid #ddd; color: #666; font-style: italic;">Please quote</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;">P-002</td><td style="padding: 8px; border: 1px solid #ddd;">Fuel Pump</td><td style="padding: 8px; border: 1px solid #ddd;">2</td><td style="padding: 8px; border: 1px solid #ddd; color: #666; font-style: italic;">Please quote</td></tr>
            </tbody>
          </table>`,
            quotationRequestBox: `<div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-left: 4px solid #2563eb; border-radius: 4px;">
            <strong>Quotation Request:</strong>
            <p style="margin: 8px 0 0 0;">Please provide your quotation including:</p>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>Unit price for each item</li>
              <li>Total cost</li>
              <li>Estimated delivery date</li>
              <li>Payment terms</li>
            </ul>
          </div>`,
          }
        : {
            soNumber: "SO-2025-0001",
            serviceProviderName: "Marine Services Co",
            vesselName: "<p><strong>Vessel:</strong> MV Pacific Star</p>",
            equipmentName: "<p><strong>Equipment:</strong> Main Engine</p>",
            workOrderNumber: "<p><strong>Work Order:</strong> WO-2025-0001</p>",
            scheduleInfo: "<p><strong>Scheduled:</strong> Jan 10, 2025 - Jan 15, 2025</p>",
            durationInfo: "<p><strong>Estimated Duration:</strong> 8 hours</p>",
            scopeOfWork: `<div style="margin: 15px 0; padding: 12px; background: #f9f9f9; border-radius: 4px;">
            <strong>Scope of Work:</strong>
            <p style="margin-top: 8px;">Complete engine overhaul including inspection, parts replacement, and testing.</p>
          </div>`,
            specialRequirements: `<div style="margin: 15px 0; padding: 12px; background: #fff3cd; border-radius: 4px;">
            <strong>Special Requirements:</strong>
            <p style="margin-top: 8px;">Crane access required for heavy parts removal.</p>
          </div>`,
            quotationRequestBox: `<div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-left: 4px solid #2563eb; border-radius: 4px;">
            <strong>Quotation Request:</strong>
            <p style="margin: 8px 0 0 0;">Please provide a quote, price list, and payment terms.</p>
          </div>`,
          };

    return {
      subject: this.renderTemplate(template.subject, sampleData),
      body: this.renderTemplate(template.body, sampleData),
    };
  }
}

export const emailTemplatesService = new EmailTemplatesService();
