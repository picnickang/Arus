import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Tools:EnhancedReportTools");
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { registerTool } from "./registry";
import { enhancedLLM } from "../../../enhanced-llm/enhanced-llm";
import {
  getReportArtifact as lookupReportArtifact,
  storeReportArtifact,
} from "./enhanced-report-artifacts";
import {
  REPORT_TYPE_LABELS,
  formatReportAsText,
  generatePdfBuffer,
  resolveAudience,
  resolveTimeframeDays,
} from "./enhanced-report-formatters";

export { getReportArtifact } from "./enhanced-report-artifacts";

registerTool({
  name: "generateReport",
  category: "analytics",
  riskLevel: "read",
  description:
    "Generate a comprehensive AI-powered report. Supports report types: health (vessel health), fleet_summary (fleet-wide overview), maintenance (maintenance analysis), compliance (regulatory compliance), cost_summary (cost and ROI analysis). Reports are audience-aware and include a download link. Use the shareReport tool if the user wants to email or share the report externally.",
  parameters: {
    type: "object",
    properties: {
      reportType: {
        type: "string",
        enum: ["health", "fleet_summary", "maintenance", "compliance", "cost_summary"],
        description: "Type of report to generate",
      },
      vesselId: {
        type: "string",
        description:
          "Vessel ID to scope the report. Required for 'health' reports, optional for 'maintenance' and 'compliance', not used for 'fleet_summary' or 'cost_summary'.",
      },
      timeRange: {
        type: "string",
        enum: ["24h", "7d", "30d", "90d", "180d", "1y"],
        description: "Time range for the report data. Default is '30d' (30 days).",
      },
      audience: {
        type: "string",
        enum: ["executive", "technical", "maintenance", "compliance"],
        description:
          "Target audience for the report. If not specified, automatically determined from user role.",
      },
      outputFormat: {
        type: "string",
        enum: ["inline", "pdf", "json", "csv"],
        description:
          "Output format. 'inline' shows the report in chat (default). 'pdf', 'json', and 'csv' generate downloadable files.",
      },
      includeScenarios: {
        type: "boolean",
        description: "Include what-if scenario analysis (default false)",
      },
      includeROI: {
        type: "boolean",
        description:
          "Include ROI/cost-benefit analysis (default false, always true for cost_summary)",
      },
    },
    required: ["reportType"],
  },
  inputSchema: z.object({
    reportType: z.enum(["health", "fleet_summary", "maintenance", "compliance", "cost_summary"]),
    vesselId: z.string().optional(),
    timeRange: z.enum(["24h", "7d", "30d", "90d", "180d", "1y"]).optional(),
    audience: z.enum(["executive", "technical", "maintenance", "compliance"]).optional(),
    outputFormat: z.enum(["inline", "pdf", "json", "csv"]).optional(),
    includeScenarios: z.boolean().optional(),
    includeROI: z.boolean().optional(),
  }),
  requiresApproval: false,
  async execute(input, ctx) {
    const {
      reportType,
      vesselId,
      timeRange,
      audience: requestedAudience,
      outputFormat = "inline",
      includeScenarios,
      includeROI,
    } = input as {
      reportType: "health" | "fleet_summary" | "maintenance" | "compliance" | "cost_summary";
      vesselId?: string;
      timeRange?: string;
      audience?: string;
      outputFormat?: string;
      includeScenarios?: boolean;
      includeROI?: boolean;
    };

    const audience = resolveAudience(ctx.userRole, requestedAudience);
    const timeframeDays = resolveTimeframeDays(timeRange);

    const isCostSummary = reportType === "cost_summary";
    const options = {
      includeScenarios: includeScenarios || false,
      includeROI: isCostSummary ? true : includeROI || false,
      timeframeDays,
    };

    try {
      let result;
      const effectiveReportType = isCostSummary ? "fleet_summary" : reportType;

      switch (effectiveReportType) {
        case "health": {
          if (!vesselId) {
            return {
              error:
                "vesselId is required for health reports. Please specify which vessel to generate the report for.",
            };
          }
          result = await enhancedLLM.generateVesselHealthReport(vesselId, audience, options);
          break;
        }
        case "fleet_summary": {
          const costAudience = requestedAudience ? audience : "executive";
          result = await enhancedLLM.generateFleetSummaryReport(
            isCostSummary ? costAudience : audience,
            options
          );
          break;
        }
        case "maintenance": {
          result = await enhancedLLM.generateMaintenanceReport(vesselId, audience, options);
          break;
        }
        case "compliance": {
          result = await enhancedLLM.generateComplianceReport(vesselId, audience, options);
          break;
        }
        default:
          return { error: `Unknown report type: ${reportType}` };
      }

      const reportId = randomUUID();
      const reportLabel = REPORT_TYPE_LABELS[reportType] || "Report";

      const response: Record<string, unknown> = {
        reportId,
        reportType,
        reportTitle: reportLabel,
        audience,
        timeRange: timeRange || "30d",
        timeframeDays,
        generatedAt: new Date().toISOString(),
        analysis: result.analysis,
        confidence: result.confidence,
        metadata: result.metadata,
        orgId: ctx.orgId,
      };

      if (result.scenarios && result.scenarios.length > 0) {
        response["scenarios"] = result.scenarios;
      }
      if (result.roi) {
        response["roi"] = result.roi;
      }
      if (result.citations && result.citations.length > 0) {
        response["citations"] = result.citations.slice(0, 5);
      }
      if (vesselId) {
        response["vesselId"] = vesselId;
      }

      if (ctx.knowledgeBase) {
        try {
          const kbQuery = `${reportType} ${vesselId ? `vessel ${vesselId}` : "fleet"} reference documentation`;
          const kbResult = await ctx.knowledgeBase.search(ctx.orgId, kbQuery, { maxSources: 3 });
          if (!kbResult.error && kbResult.citations.length > 0) {
            response["referenceDocuments"] = kbResult.citations.map((c, i) => ({
              ref: `[${i + 1}]`,
              document: c.docName,
              relevance: `${(c.relevance * 100).toFixed(0)}%`,
              excerpt: c.text.length > 150 ? `${c.text.slice(0, 150)}...` : c.text,
            }));
          }
        } catch (err) {
          logger.warn("[Agent] KB enrichment query failed:", {
            details: err instanceof Error ? err.message : "unknown",
          });
        }
      }

      try {
        const textContent = formatReportAsText(
          reportType,
          audience,
          result.analysis,
          response,
          vesselId
        );
        const artifactFormat = outputFormat === "inline" ? "pdf" : outputFormat;
        let pdfBuffer: Buffer | undefined;
        if (artifactFormat === "pdf") {
          pdfBuffer = await generatePdfBuffer(
            reportType,
            audience,
            result.analysis,
            response,
            vesselId
          );
        }
        const artifact = await storeReportArtifact(
          reportId,
          ctx.orgId,
          ctx.userId,
          reportType,
          textContent,
          response,
          artifactFormat,
          pdfBuffer
        );
        response["artifact"] = {
          fileName: artifact.fileName,
          format: artifactFormat,
          downloadUrl: `/api/agent/reports/${reportId}/download`,
        };
        response["downloadAvailable"] = true;
      } catch (artifactErr) {
        response["artifactError"] =
          "Report generated successfully but file export failed. The report content is available inline above.";
      }

      response["previewCard"] = {
        title: reportLabel,
        subtitle: vesselId ? `Vessel: ${vesselId}` : "Fleet-wide",
        audience,
        confidence: result.confidence,
        generatedAt: response["generatedAt"],
        hasDownload: !!response["artifact"],
        format: outputFormat,
      };

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not initialized") || message.includes("API key")) {
        return {
          error: "AI report generation is not available. The OpenAI API key may not be configured.",
          suggestion: "Please ensure the OpenAI API key is set in system settings.",
        };
      }
      if (message.includes("not found") || message.includes("No vessel")) {
        return {
          error: `Vessel not found: ${vesselId || "unknown"}. Please verify the vessel ID and try again.`,
          suggestion: "Use the getVesselOverview tool to look up valid vessel IDs first.",
        };
      }
      if (message.includes("No data") || message.includes("no telemetry")) {
        return {
          error: `Insufficient data to generate ${reportType} report${vesselId ? ` for vessel ${vesselId}` : ""}.`,
          suggestion:
            "Ensure the vessel has recent telemetry or maintenance data before requesting a report.",
        };
      }
      return { error: `Report generation failed: ${message}` };
    }
  },
});

registerTool({
  name: "shareReport",
  category: "analytics",
  riskLevel: "low-write",
  description:
    "Share or email a previously generated report to external recipients. This creates a draft that requires human approval before the report is sent. Use generateReport first to create the report, then use this tool with the reportId to share it.",
  parameters: {
    type: "object",
    properties: {
      reportId: {
        type: "string",
        description: "The ID of the report to share (from generateReport result)",
      },
      recipients: {
        type: "array",
        items: { type: "string" },
        description: "Email addresses of the recipients",
      },
      subject: {
        type: "string",
        description: "Email subject line (optional, auto-generated if not provided)",
      },
      message: {
        type: "string",
        description: "Optional message to include with the report",
      },
    },
    required: ["reportId", "recipients"],
  },
  inputSchema: z.object({
    reportId: z.string().uuid(),
    recipients: z.array(z.string().email()).min(1).max(10),
    subject: z.string().optional(),
    message: z.string().optional(),
  }),
  requiresApproval: true,
  async execute(input, ctx) {
    const { reportId, recipients, subject, message } = input as {
      reportId: string;
      recipients: string[];
      subject?: string;
      message?: string;
    };

    const artifact = lookupReportArtifact(reportId);
    if (!artifact) {
      return {
        error:
          "Report not found. Please generate a report first using the generateReport tool before sharing it.",
      };
    }
    if (artifact.orgId !== ctx.orgId) {
      return { error: "Report not found or access denied." };
    }

    return {
      draftType: "report_share",
      data: {
        reportId,
        recipients,
        subject: subject || `ARUS Report - ${new Date().toLocaleDateString()}`,
        message: message || "",
        orgId: ctx.orgId,
        requestedBy: ctx.userId,
        artifactFileName: artifact?.fileName,
        artifactFormat: artifact?.format,
      },
      requiresApproval: true,
      message: `Report share draft created. The report (${reportId}) will be sent to ${recipients.join(", ")} after approval.`,
    };
  },
});
