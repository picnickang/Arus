/**
 * Email Templates
 * Email HTML generation for purchase orders
 */

import { emailTemplatesService } from "../domains/alerts/email-templates-service";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString();
}

function buildItemsTableHtml(
  items: { partName?: string; partNumber?: string; quantity: number }[]
): string {
  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.partNumber || "N/A"}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.partName || "Unknown Part"}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #666; font-style: italic;">Please quote</td>
    </tr>
  `
    )
    .join("");

  return `<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Part Number</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Quantity</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Unit Price</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>`;
}

function buildQuotationRequestBox(): string {
  return `<div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-left: 4px solid #2563eb; border-radius: 4px;">
    <strong>Quotation Request:</strong>
    <p style="margin: 8px 0 0 0;">Please provide your quotation including:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li>Unit price for each item</li>
      <li>Total cost</li>
      <li>Estimated delivery date</li>
      <li>Payment terms</li>
    </ul>
  </div>`;
}

export async function generatePOEmailHtmlWithTemplate(
  orgId: string,
  po: { id: string; orderNumber: string },
  items: { partName?: string; partNumber?: string; quantity: number }[],
  supplier: { name: string },
  pr: { requestNumber: string; requiredByDate?: Date | string | null }
): Promise<{ subject: string; body: string }> {
  const templates = await emailTemplatesService.getTemplates(orgId);
  const template = templates.purchaseOrder;

  const placeholderData: Record<string, string> = {
    orderNumber: po.orderNumber,
    supplierName: supplier.name,
    requestNumber: pr.requestNumber,
    requiredByDate: pr.requiredByDate
      ? `<p><strong>Required By:</strong> ${formatDate(pr.requiredByDate)}</p>`
      : "",
    itemsTable: buildItemsTableHtml(items),
    quotationRequestBox: buildQuotationRequestBox(),
  };

  return {
    subject: emailTemplatesService.renderTemplate(template.subject, placeholderData),
    body: emailTemplatesService.renderTemplate(template.body, placeholderData),
  };
}

export function generatePOEmailHtml(
  po: { id: string; orderNumber: string },
  items: { partName?: string; partNumber?: string; quantity: number }[],
  supplier: { name: string },
  pr: { requestNumber: string; requiredByDate?: Date | string | null }
): string {
  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.partNumber || "N/A"}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.partName || "Unknown Part"}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #666; font-style: italic;">Please quote</td>
    </tr>
  `
    )
    .join("");

  const requiredByHtml = pr.requiredByDate
    ? `<p><strong>Required By:</strong> ${formatDate(pr.requiredByDate)}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Purchase Order: ${po.orderNumber}</h2>
  <p>Dear ${supplier.name},</p>
  <p>Please find below the details for Purchase Order <strong>${po.orderNumber}</strong> 
     (Reference: ${pr.requestNumber}).</p>
  
  ${requiredByHtml}
  
  <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Part Number</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Quantity</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Unit Price</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  
  <div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-left: 4px solid #2563eb; border-radius: 4px;">
    <strong>Quotation Request:</strong>
    <p style="margin: 8px 0 0 0;">Please provide your quotation including:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li>Unit price for each item</li>
      <li>Total cost</li>
      <li>Estimated delivery date</li>
      <li>Payment terms</li>
    </ul>
  </div>
  
  <p>Please confirm receipt of this order and provide expected delivery dates along with your pricing.</p>
  <p>Best regards,<br>ARUS Procurement System</p>
</body>
</html>
  `;
}
