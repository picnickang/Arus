import fs from "fs";
import { getReportArtifact } from "../tools/enhanced-report-tools";

export interface WorkOrderCreatorPort {
  createWorkOrder(input: Record<string, unknown> & { status: string; orgId: string }): Promise<{ id: string }>;
}

export interface DraftExecutorDeps {
  workOrderCreator: WorkOrderCreatorPort;
}

export interface DraftExecutionResult {
  resultId?: string;
  error?: string;
  partialFailures?: string[];
}

export function createDraftExecutor(deps: DraftExecutorDeps) {
  return async function executeDraftAction(
    draftType: string,
    data: Record<string, unknown>,
    orgId: string
  ): Promise<DraftExecutionResult> {
    if (draftType === "work_order") {
      const wo = await deps.workOrderCreator.createWorkOrder({ ...data, status: "open", orgId });
      return { resultId: wo.id };
    }

    if (draftType === "report_share") {
      const recipients = data['recipients'] as string[];
      const subject = data['subject'] as string;
      const bodyText = (data['message'] as string) || "Please find the attached ARUS report.";
      const reportArtifact = getReportArtifact(data['reportId'] as string);

      if (!reportArtifact || !fs.existsSync(reportArtifact.filePath)) {
        return { error: "Report artifact not found or file no longer available." };
      }

      if (reportArtifact.orgId !== orgId) {
        return { error: "Access denied to report artifact" };
      }

      const { emailSender } = await import("../../../services/email-notification/email-sender.js");
      const fileContent = fs.readFileSync(reportArtifact.filePath);
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        json: "application/json",
        csv: "text/csv",
        txt: "text/plain",
      };

      const sendErrors: string[] = [];
      for (const recipient of recipients) {
        try {
          await emailSender.sendWithAttachment(recipient, subject, bodyText, `<p>${bodyText}</p>`, {
            filename: reportArtifact.fileName,
            content: fileContent,
            contentType: mimeMap[reportArtifact.format] || "application/octet-stream",
          });
        } catch (err) {
          sendErrors.push(`${recipient}: ${err instanceof Error ? err.message : "send failed"}`);
        }
      }

      if (sendErrors.length > 0 && sendErrors.length === recipients.length) {
        return { error: "Failed to send report to all recipients", partialFailures: sendErrors };
      }

      return {
        resultId: data['reportId'] as string,
        partialFailures: sendErrors.length > 0 ? sendErrors : undefined,
      };
    }

    return {};
  };
}
