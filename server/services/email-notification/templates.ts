/**
 * Email Notification - Email Templates
 */

import type { ComplianceFinding } from "@shared/schema";
import { SEVERITY_COLORS } from "./types.js";

export function getSeverityColor(severity: string): string {
  return SEVERITY_COLORS[severity] || "#6b7280";
}

export function getUrgencyInfo(daysUntilExpiry: number): { color: string; label: string } {
  if (daysUntilExpiry <= 30) {
    return { color: "#ef4444", label: "URGENT" };
  }
  if (daysUntilExpiry <= 60) {
    return { color: "#f59e0b", label: "WARNING" };
  }
  return { color: "#3b82f6", label: "NOTICE" };
}

export function buildComplianceSubject(finding: ComplianceFinding, vesselName: string): string {
  const severityPrefix = finding.severity === "critical" ? "[CRITICAL] " : "";
  return `${severityPrefix}Compliance Finding - ${finding.ruleName || finding.ruleCode} - ${vesselName}`;
}

export function buildComplianceBody(
  finding: ComplianceFinding,
  vesselName: string
): { text: string; html: string } {
  const text = `
Compliance Finding Detected

Vessel: ${vesselName}
Rule: ${finding.ruleName || finding.ruleCode}
Category: ${finding.category || "N/A"}
Severity: ${finding.severity}
Date: ${finding.logDate}

${finding.message}

Source: ${finding.sourceType}
Status: ${finding.status}
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${getSeverityColor(finding.severity)};">Compliance Finding Detected</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Vessel:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${vesselName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Rule:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${finding.ruleName || finding.ruleCode}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Category:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${finding.category || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Severity:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="color: ${getSeverityColor(finding.severity)}; font-weight: bold;">${finding.severity.toUpperCase()}</span></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${finding.logDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Source:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${finding.sourceType}</td></tr>
      </table>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;">${finding.message}</p>
      </div>
      <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">This is an automated compliance notification from ARUS Marine.</p>
    </div>
  `;

  return { text, html };
}

export function buildAlertBody(
  alert: { type: string; message: string; severity: string },
  vesselName: string,
  equipmentName: string
): { text: string; html: string } {
  const text = `Alert Type: ${alert.type}\nEquipment: ${equipmentName}\nVessel: ${vesselName}\nSeverity: ${alert.severity}\n\n${alert.message}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${getSeverityColor(alert.severity)};">[${alert.severity.toUpperCase()}] Equipment Alert</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Alert Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.type}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Equipment:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${equipmentName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Vessel:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${vesselName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Severity:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.severity}</td></tr>
      </table>
      <p>${alert.message}</p>
      <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">This is an automated alert from ARUS Marine.</p>
    </div>
  `;
  return { text, html };
}

export function buildLogbookReminderBody(
  logType: "deck" | "engine",
  vesselName: string,
  logDate: string
): { subject: string; text: string; html: string } {
  const subject = `${logType === "deck" ? "Deck" : "Engine"} Logbook Reminder - ${vesselName}`;
  const text = `The ${logType === "deck" ? "Deck" : "Engine Room"} logbook for ${vesselName} on ${logDate} has not been signed.\n\nPlease review and sign the log entries to maintain compliance.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Logbook Signature Reminder</h2>
      <p>The <strong>${logType === "deck" ? "Deck" : "Engine Room"}</strong> logbook for <strong>${vesselName}</strong> on <strong>${logDate}</strong> has not been signed.</p>
      <p>Please review and sign the log entries to maintain compliance.</p>
      <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">This is an automated notification from ARUS Marine.</p>
    </div>
  `;
  return { subject, text, html };
}
