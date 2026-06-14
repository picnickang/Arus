/**
 * Email Notification - Crew Notifications
 */

import { crewAppService as crewService } from "../../domains/crew/application/index.js";
import type { Crew, CrewCertification, CrewDocument } from "@shared/schema";
import { format } from "date-fns";
import { log } from "./logger.js";
import { emailSender } from "./email-sender.js";
import type { CrewNotificationCheck } from "./types.js";
import { getUrgencyInfo, getSeverityColor } from "./templates.js";
import { alertSettingsService } from "../../domains/alerts/settings-service.js";

async function getAdminEmailIfEnabled(orgId: string): Promise<string | null> {
  try {
    const crewAlertSettings = await alertSettingsService.getCrewAlertSettings(orgId);
    if (!crewAlertSettings?.sendToAdminEmail) {
      return null;
    }
    const alertSettings = await alertSettingsService.getSettings(orgId);
    return alertSettings?.defaultToEmail || null;
  } catch (error) {
    log("warn", "Failed to get admin email for crew alerts", {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function checkCrewNotificationEnabled(
  crewId: string,
  orgId: string,
  notificationType: "certExpiry" | "documentExpiry" | "compliance"
): Promise<CrewNotificationCheck> {
  try {
    const crew = await crewService.getCrewById(crewId, orgId);

    if (!crew) {
      log("warn", "Crew not found or org mismatch - denying notification", { crewId, orgId });
      return { enabled: false, email: null, overrideEmail: null };
    }

    const settings = await crewService.getCrewNotificationSettings(crewId, orgId);

    if (!settings) {
      return {
        enabled: true,
        email: crew.email || null,
        overrideEmail: null,
      };
    }

    if (!settings.emailAlertsEnabled) {
      return { enabled: false, email: null, overrideEmail: null };
    }

    const notificationSettingsMap: Record<string, boolean> = {
      certExpiry: settings.certExpiryEmailEnabled ?? true,
      documentExpiry: settings.documentExpiryEmailEnabled ?? true,
      compliance: settings.complianceEmailEnabled ?? true,
    };
    const typeEnabled = notificationSettingsMap[notificationType] ?? true;

    return {
      enabled: typeEnabled,
      email: crew.email || null,
      overrideEmail: settings.overrideEmail ?? null,
    };
  } catch (error) {
    log("error", "Failed to check crew notification settings", {
      crewId,
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { enabled: false, email: null, overrideEmail: null };
  }
}

export async function sendCertificationExpiryNotification(
  crew: Crew,
  certification: CrewCertification,
  daysUntilExpiry: number,
  orgId: string
): Promise<boolean> {
  const check = await checkCrewNotificationEnabled(crew.id, orgId, "certExpiry");
  if (!check.enabled) {
    log("info", "Certification expiry email skipped - disabled by crew settings", {
      crewId: crew.id,
      certificationId: certification.id,
    });
    return false;
  }

  const recipientEmail = check.overrideEmail || check.email;
  if (!recipientEmail) {
    log("warn", "Certification expiry email skipped - no email address", { crewId: crew.id });
    return false;
  }

  const expiresAt = certification.expiresAt
    ? format(new Date(certification.expiresAt), "MMMM d, yyyy")
    : "Unknown";
  const { color: urgencyColor, label: urgencyLabel } = getUrgencyInfo(daysUntilExpiry);

  const certName = (certification as { name?: string }).name ?? "Unknown";
  const subject = `[${urgencyLabel}] Certification Expiring - ${certName} for ${crew.name}`;
  const text = `
Certification Expiry Notice

Crew Member: ${crew.name}
Rank: ${crew.rank || "N/A"}
Certification: ${certName}
Certification Number: ${certification.certNumber || "N/A"}
Expiry Date: ${expiresAt}
Days Remaining: ${daysUntilExpiry}

Please ensure this certification is renewed before the expiry date to maintain regulatory compliance.
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${urgencyColor};">[${urgencyLabel}] Certification Expiry Notice</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Crew Member:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${crew.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Rank:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${crew.rank || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Certification:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${certName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Certification Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${certification.certNumber || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Expiry Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="color: ${urgencyColor}; font-weight: bold;">${expiresAt}</span></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Days Remaining:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="color: ${urgencyColor}; font-weight: bold;">${daysUntilExpiry} days</span></td></tr>
      </table>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
        <p style="margin: 0;"><strong>Action Required:</strong> Please ensure this certification is renewed before the expiry date to maintain regulatory compliance.</p>
      </div>
      <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from ARUS Marine Crew Management.</p>
    </div>
  `;

  const recipients = [recipientEmail];
  const adminEmail = await getAdminEmailIfEnabled(orgId);
  if (adminEmail && adminEmail !== recipientEmail) {
    recipients.push(adminEmail);
  }

  const result = await emailSender.sendEmail({ to: recipients, subject, text, html }, orgId);
  return result.success;
}

export async function sendDocumentExpiryNotification(
  crew: Crew,
  document: CrewDocument,
  daysUntilExpiry: number,
  orgId: string
): Promise<boolean> {
  const check = await checkCrewNotificationEnabled(crew.id, orgId, "documentExpiry");
  if (!check.enabled) {
    log("info", "Document expiry email skipped - disabled by crew settings", {
      crewId: crew.id,
      documentId: document.id,
    });
    return false;
  }

  const recipientEmail = check.overrideEmail || check.email;
  if (!recipientEmail) {
    log("warn", "Document expiry email skipped - no email address", { crewId: crew.id });
    return false;
  }

  const expiresAt = document.expiresAt
    ? format(new Date(document.expiresAt), "MMMM d, yyyy")
    : "Unknown";
  const { color: urgencyColor, label: urgencyLabel } = getUrgencyInfo(daysUntilExpiry);

  const subject = `[${urgencyLabel}] Document Expiring - ${document.documentType} for ${crew.name}`;
  const text = `
Document Expiry Notice

Crew Member: ${crew.name}
Rank: ${crew.rank || "N/A"}
Document Type: ${document.documentType}
Document Number: ${document.documentNumber || "N/A"}
Expiry Date: ${expiresAt}
Days Remaining: ${daysUntilExpiry}

Please ensure this document is renewed before the expiry date to maintain regulatory compliance.
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${urgencyColor};">[${urgencyLabel}] Document Expiry Notice</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Crew Member:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${crew.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Rank:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${crew.rank || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Document Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${document.documentType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Document Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${document.documentNumber || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Expiry Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="color: ${urgencyColor}; font-weight: bold;">${expiresAt}</span></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Days Remaining:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="color: ${urgencyColor}; font-weight: bold;">${daysUntilExpiry} days</span></td></tr>
      </table>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
        <p style="margin: 0;"><strong>Action Required:</strong> Please ensure this document is renewed before the expiry date to maintain regulatory compliance.</p>
      </div>
      <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from ARUS Marine Crew Management.</p>
    </div>
  `;

  const recipients = [recipientEmail];
  const adminEmail = await getAdminEmailIfEnabled(orgId);
  if (adminEmail && adminEmail !== recipientEmail) {
    recipients.push(adminEmail);
  }

  const result = await emailSender.sendEmail({ to: recipients, subject, text, html }, orgId);
  return result.success;
}

export async function sendCrewComplianceNotification(
  crew: Crew,
  complianceType: string,
  message: string,
  severity: "info" | "warning" | "critical",
  orgId: string
): Promise<boolean> {
  const check = await checkCrewNotificationEnabled(crew.id, orgId, "compliance");
  if (!check.enabled) {
    log("info", "Crew compliance email skipped - disabled by crew settings", {
      crewId: crew.id,
      complianceType,
    });
    return false;
  }

  const recipientEmail = check.overrideEmail || check.email;
  if (!recipientEmail) {
    log("warn", "Crew compliance email skipped - no email address", { crewId: crew.id });
    return false;
  }

  const severityColor = getSeverityColor(severity);
  const severityLabel = severity.toUpperCase();

  const subject = `[${severityLabel}] Compliance Alert - ${complianceType} for ${crew.name}`;
  const text = `
Crew Compliance Alert

Crew Member: ${crew.name}
Rank: ${crew.rank || "N/A"}
Compliance Type: ${complianceType}
Severity: ${severityLabel}

${message}

Please address this compliance issue promptly.
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${severityColor};">[${severityLabel}] Crew Compliance Alert</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Crew Member:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${crew.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Rank:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${crew.rank || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Compliance Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${complianceType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Severity:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="color: ${severityColor}; font-weight: bold;">${severityLabel}</span></td></tr>
      </table>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${severityColor};">
        <p style="margin: 0;">${message}</p>
      </div>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Action Required:</strong> Please address this compliance issue promptly.</p>
      </div>
      <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from ARUS Marine Crew Management.</p>
    </div>
  `;

  const recipients = [recipientEmail];
  const adminEmail = await getAdminEmailIfEnabled(orgId);
  if (adminEmail && adminEmail !== recipientEmail) {
    recipients.push(adminEmail);
  }

  const result = await emailSender.sendEmail({ to: recipients, subject, text, html }, orgId);
  return result.success;
}
