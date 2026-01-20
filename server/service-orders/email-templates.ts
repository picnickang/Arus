/**
 * Email Templates
 * Email HTML generation for service orders
 */

import { emailTemplatesService } from '../domains/alerts/email-templates-service';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {return "";}
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString();
}

interface SOData {
  id: string;
  soNumber: string;
  scope?: string | null;
  scheduledStartDate?: Date | string | null;
  scheduledEndDate?: Date | string | null;
  specialRequirements?: string | null;
  estimatedDurationHours?: number | null;
  quotedAmount?: number | null;
  currency?: string | null;
}

function buildSOPlaceholderData(
  so: SOData,
  serviceProvider: { name: string },
  workOrder?: { woNumber?: string | null; description?: string | null },
  equipment?: { name?: string | null },
  vessel?: { name?: string | null }
): Record<string, string> {
  const hasQuote = so.quotedAmount !== null && so.quotedAmount !== undefined;
  
  return {
    soNumber: so.soNumber,
    serviceProviderName: serviceProvider.name,
    vesselName: vessel?.name ? `<p><strong>Vessel:</strong> ${vessel.name}</p>` : '',
    equipmentName: equipment?.name ? `<p><strong>Equipment:</strong> ${equipment.name}</p>` : '',
    workOrderNumber: workOrder?.woNumber ? `<p><strong>Work Order:</strong> ${workOrder.woNumber}</p>` : '',
    scheduleInfo: (so.scheduledStartDate || so.scheduledEndDate)
      ? `<p><strong>Scheduled:</strong> ${formatDate(so.scheduledStartDate)} - ${formatDate(so.scheduledEndDate)}</p>`
      : '',
    durationInfo: so.estimatedDurationHours
      ? `<p><strong>Estimated Duration:</strong> ${so.estimatedDurationHours} hours</p>`
      : '',
    scopeOfWork: so.scope
      ? `<div style="margin: 15px 0; padding: 12px; background: #f9f9f9; border-radius: 4px;">
          <strong>Scope of Work:</strong>
          <p style="margin-top: 8px;">${so.scope}</p>
        </div>`
      : '',
    specialRequirements: so.specialRequirements
      ? `<div style="margin: 15px 0; padding: 12px; background: #fff3cd; border-radius: 4px;">
          <strong>Special Requirements:</strong>
          <p style="margin-top: 8px;">${so.specialRequirements}</p>
        </div>`
      : '',
    quotationRequestBox: !hasQuote
      ? `<div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-left: 4px solid #2563eb; border-radius: 4px;">
          <strong>Quotation Request:</strong>
          <p style="margin: 8px 0 0 0;">Please provide a quote, price list, and payment terms.</p>
        </div>`
      : '',
  };
}

export async function generateSOEmailHtmlWithTemplate(
  orgId: string,
  so: SOData,
  serviceProvider: { name: string },
  workOrder?: { woNumber?: string | null; description?: string | null },
  equipment?: { name?: string | null },
  vessel?: { name?: string | null }
): Promise<{ subject: string; body: string }> {
  const templates = await emailTemplatesService.getTemplates(orgId);
  const template = templates.serviceOrder;
  
  const placeholderData = buildSOPlaceholderData(so, serviceProvider, workOrder, equipment, vessel);
  
  return {
    subject: emailTemplatesService.renderTemplate(template.subject, placeholderData),
    body: emailTemplatesService.renderTemplate(template.body, placeholderData),
  };
}

export function generateSOEmailHtml(
  so: {
    id: string;
    soNumber: string;
    scope?: string | null;
    scheduledStartDate?: Date | string | null;
    scheduledEndDate?: Date | string | null;
    specialRequirements?: string | null;
    estimatedDurationHours?: number | null;
    quotedAmount?: number | null;
    currency?: string | null;
  },
  serviceProvider: { name: string },
  workOrder?: { woNumber?: string | null; description?: string | null },
  equipment?: { name?: string | null },
  vessel?: { name?: string | null }
): string {
  const workOrderInfo = workOrder?.woNumber
    ? `<p><strong>Work Order:</strong> ${workOrder.woNumber}</p>`
    : "";

  const equipmentInfo = equipment?.name
    ? `<p><strong>Equipment:</strong> ${equipment.name}</p>`
    : "";

  const vesselInfo = vessel?.name
    ? `<p><strong>Vessel:</strong> ${vessel.name}</p>`
    : "";

  const scheduleInfo =
    so.scheduledStartDate || so.scheduledEndDate
      ? `<p><strong>Scheduled:</strong> ${formatDate(so.scheduledStartDate)} - ${formatDate(so.scheduledEndDate)}</p>`
      : "";

  const durationInfo = so.estimatedDurationHours
    ? `<p><strong>Estimated Duration:</strong> ${so.estimatedDurationHours} hours</p>`
    : "";

  const hasQuote = so.quotedAmount !== null && so.quotedAmount !== undefined;
  const quotedInfo = hasQuote
    ? `<p><strong>Quoted Amount:</strong> ${so.currency || "USD"} ${so.quotedAmount.toLocaleString()}</p>`
    : "";
  
  const pricingRequestInfo = !hasQuote
    ? `<div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-left: 4px solid #2563eb; border-radius: 4px;">
        <strong>Quotation Request:</strong>
        <p style="margin: 8px 0 0 0;">Please provide a quote, price list, and payment terms.</p>
      </div>`
    : "";

  const scopeInfo = so.scope
    ? `<div style="margin: 15px 0; padding: 12px; background: #f9f9f9; border-radius: 4px;">
        <strong>Scope of Work:</strong>
        <p style="margin-top: 8px;">${so.scope}</p>
      </div>`
    : "";

  const requirementsInfo = so.specialRequirements
    ? `<div style="margin: 15px 0; padding: 12px; background: #fff3cd; border-radius: 4px;">
        <strong>Special Requirements:</strong>
        <p style="margin-top: 8px;">${so.specialRequirements}</p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb;">Service Order: ${so.soNumber}</h2>
  <p>Dear ${serviceProvider.name},</p>
  <p>Please find below the details for Service Order <strong>${so.soNumber}</strong>.</p>
  
  <div style="margin: 20px 0; padding: 16px; background: #f5f5f5; border-radius: 8px;">
    ${vesselInfo}
    ${equipmentInfo}
    ${workOrderInfo}
    ${scheduleInfo}
    ${durationInfo}
    ${quotedInfo}
  </div>
  
  ${scopeInfo}
  ${requirementsInfo}
  ${pricingRequestInfo}
  
  <p style="margin-top: 24px;">Please confirm receipt of this service order and provide availability confirmation${!hasQuote ? " along with your pricing quotation" : ""}.</p>
  <p>Best regards,<br><strong>ARUS Maritime Operations</strong></p>
</body>
</html>
  `;
}
