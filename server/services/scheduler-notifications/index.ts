// @ts-nocheck
/**
 * Scheduler Notification Service
 * Sends email notifications for schedule events based on scheduling-settings matrix
 */

import { emailSender } from "../email-notification/email-sender.js";
import { dbSchedulerStorage, dbUserStorage, dbCrewStorage } from "../../repositories.js";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:SchedulerNotifications:Index");
import type {
  NotificationSettings,
  NotificationRecipient,
} from "../../../shared/schema/scheduling-settings.js";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../../../shared/schema/scheduling-settings.js";

interface ScheduleNotificationContext {
  orgId: string;
  vesselId?: string;
  crewId?: string;
  crewEmail?: string;
  adminEmails?: string[];
}

interface AssignmentInfo {
  id: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName?: string;
  startDate: string;
  endDate: string;
  role?: string;
}

type NotificationEvent = keyof NotificationSettings;

async function getNotificationSettings(
  orgId: string,
  vesselId?: string
): Promise<NotificationSettings> {
  try {
    if (vesselId) {
      const vesselSettings = await dbSchedulerStorage.getSchedulingSettingsByVessel(
        orgId,
        vesselId
      );
      if (vesselSettings?.notificationSettings) {
        return vesselSettings.notificationSettings;
      }
    }
    const orgSettings = await dbSchedulerStorage.getSchedulingSettings(orgId);
    if (orgSettings?.notificationSettings) {
      return orgSettings.notificationSettings;
    }
  } catch (error) {
    logger.error("Failed to load notification settings:", undefined, error);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

async function getRecipientEmails(
  recipient: NotificationRecipient,
  context: ScheduleNotificationContext
): Promise<string[]> {
  const emails: string[] = [];

  if (recipient === "none") {
    return emails;
  }

  if ((recipient === "crew" || recipient === "both") && context.crewEmail) {
    emails.push(context.crewEmail);
  }

  if ((recipient === "admin" || recipient === "both") && context.adminEmails) {
    emails.push(...context.adminEmails);
  }

  return [...new Set(emails)];
}

async function getAdminEmails(orgId: string): Promise<string[]> {
  try {
    const users = await dbUserStorage.getUsers(orgId);
    if (users) {
      return users
        .filter((u: any) => u.role === "admin" || u.role === "supervisor")
        .map((u: any) => u.email)
        .filter(Boolean);
    }
  } catch (error) {
    logger.error("Failed to get admin emails:", undefined, error);
  }
  return [];
}

async function getCrewEmail(crewId: string): Promise<string | undefined> {
  try {
    const crew = await dbCrewStorage.getCrewMember(crewId);
    return crew?.email;
  } catch (error) {
    logger.error("Failed to get crew email:", undefined, error);
  }
  return undefined;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function sendSchedulePublishedNotification(
  context: ScheduleNotificationContext,
  assignments: AssignmentInfo[],
  dateRange: { from: string; to: string }
): Promise<{ success: boolean; sentCount: number }> {
  const settings = await getNotificationSettings(context.orgId, context.vesselId);
  const recipient = settings.schedulePublished;

  if (recipient === "none" || assignments.length === 0) {
    return { success: true, sentCount: 0 };
  }

  const adminEmails = await getAdminEmails(context.orgId);
  let sentCount = 0;

  const uniqueCrewIds = [...new Set(assignments.map((a) => a.crewId))];

  for (const crewId of uniqueCrewIds) {
    const crewAssignments = assignments.filter((a) => a.crewId === crewId);
    const crewEmail = await getCrewEmail(crewId);
    const crewName = crewAssignments[0]?.crewName || "Crew Member";

    const emails = await getRecipientEmails(recipient, {
      ...context,
      crewId,
      crewEmail,
      adminEmails,
    });

    if (emails.length === 0) {
      continue;
    }

    const assignmentList = crewAssignments
      .map(
        (a) =>
          `- ${a.vesselName || a.vesselId}: ${formatDate(a.startDate)} to ${formatDate(a.endDate)}`
      )
      .join("\n");

    const subject = `Schedule Published: ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
    const text = `Dear ${crewName},

Your schedule has been published for the following period:
${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}

Your assignments:
${assignmentList}

Please review your schedule and contact your supervisor if you have any questions.

Best regards,
ARUS Scheduling System`;

    const html = `
<h2>Schedule Published</h2>
<p>Dear ${crewName},</p>
<p>Your schedule has been published for the following period:<br>
<strong>${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}</strong></p>
<h3>Your Assignments:</h3>
<ul>
${crewAssignments.map((a) => `<li><strong>${a.vesselName || a.vesselId}:</strong> ${formatDate(a.startDate)} to ${formatDate(a.endDate)}</li>`).join("")}
</ul>
<p>Please review your schedule and contact your supervisor if you have any questions.</p>
<p>Best regards,<br>ARUS Scheduling System</p>`;

    const result = await emailSender.sendEmail({
      to: emails,
      subject,
      text,
      html,
    });

    if (result.success) {
      sentCount++;
    }
  }

  return { success: true, sentCount };
}

export async function sendAssignmentCreatedNotification(
  context: ScheduleNotificationContext,
  assignment: AssignmentInfo
): Promise<{ success: boolean }> {
  const settings = await getNotificationSettings(context.orgId, assignment.vesselId);
  const recipient = settings.assignmentCreated;

  if (recipient === "none") {
    return { success: true };
  }

  const crewEmail = await getCrewEmail(assignment.crewId);
  const adminEmails = await getAdminEmails(context.orgId);

  const emails = await getRecipientEmails(recipient, {
    ...context,
    crewId: assignment.crewId,
    crewEmail,
    adminEmails,
  });

  if (emails.length === 0) {
    return { success: true };
  }

  const subject = `New Assignment: ${assignment.vesselName || assignment.vesselId}`;
  const text = `Dear ${assignment.crewName},

A new assignment has been created for you:

Vessel: ${assignment.vesselName || assignment.vesselId}
Period: ${formatDate(assignment.startDate)} - ${formatDate(assignment.endDate)}
${assignment.role ? `Role: ${assignment.role}` : ""}

Please review and confirm your availability.

Best regards,
ARUS Scheduling System`;

  const result = await emailSender.sendEmail({
    to: emails,
    subject,
    text,
  });

  return { success: result.success };
}

export async function sendComplianceWarningNotification(
  context: ScheduleNotificationContext,
  crewId: string,
  crewName: string,
  violations: Array<{ type: string; description: string; severity: string }>
): Promise<{ success: boolean }> {
  const settings = await getNotificationSettings(context.orgId, context.vesselId);
  const recipient = settings.complianceWarning;

  if (recipient === "none" || violations.length === 0) {
    return { success: true };
  }

  const crewEmail = await getCrewEmail(crewId);
  const adminEmails = await getAdminEmails(context.orgId);

  const emails = await getRecipientEmails(recipient, {
    ...context,
    crewId,
    crewEmail,
    adminEmails,
  });

  if (emails.length === 0) {
    return { success: true };
  }

  const violationList = violations
    .map((v) => `- [${v.severity.toUpperCase()}] ${v.type}: ${v.description}`)
    .join("\n");

  const subject = `Compliance Warning: ${crewName}`;
  const text = `STCW Compliance Warning

Crew Member: ${crewName}

The following compliance issues have been detected:
${violationList}

Please review and take appropriate action.

Best regards,
ARUS Scheduling System`;

  const result = await emailSender.sendEmail({
    to: emails,
    subject,
    text,
  });

  return { success: result.success };
}

export async function sendRestHoursViolationNotification(
  context: ScheduleNotificationContext,
  crewId: string,
  crewName: string,
  details: { date: string; actualRestHours: number; requiredRestHours: number }
): Promise<{ success: boolean }> {
  const settings = await getNotificationSettings(context.orgId, context.vesselId);
  const recipient = settings.restHoursViolation;

  if (recipient === "none") {
    return { success: true };
  }

  const crewEmail = await getCrewEmail(crewId);
  const adminEmails = await getAdminEmails(context.orgId);

  const emails = await getRecipientEmails(recipient, {
    ...context,
    crewId,
    crewEmail,
    adminEmails,
  });

  if (emails.length === 0) {
    return { success: true };
  }

  const subject = `Rest Hours Violation Alert: ${crewName}`;
  const text = `STCW Rest Hours Violation

Crew Member: ${crewName}
Date: ${formatDate(details.date)}

Violation Details:
- Required Rest: ${details.requiredRestHours} hours
- Actual Rest: ${details.actualRestHours} hours
- Deficit: ${(details.requiredRestHours - details.actualRestHours).toFixed(1)} hours

This is a violation of MLC 2006 / STCW 2010 rest hour requirements.
Immediate action is required to ensure crew safety and regulatory compliance.

Best regards,
ARUS Scheduling System`;

  const result = await emailSender.sendEmail({
    to: emails,
    subject,
    text,
  });

  return { success: result.success };
}

export const schedulerNotifications = {
  sendSchedulePublishedNotification,
  sendAssignmentCreatedNotification,
  sendComplianceWarningNotification,
  sendRestHoursViolationNotification,
};
