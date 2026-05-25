import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Tools:EnhancedReportTools");
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { registerTool } from "./registry";
import { enhancedLLM } from "../../../enhanced-llm/enhanced-llm";
import type { Audience } from "../../../enhanced-llm/types";

const REPORT_ARTIFACTS_DIR = join(process.cwd(), ".data", "report-artifacts");
const REGISTRY_FILE = join(REPORT_ARTIFACTS_DIR, "_registry.json");

interface ReportArtifactMeta {
  reportId: string;
  orgId: string;
  userId?: string | undefined;
  fileName: string;
  filePath: string;
  format: string;
  reportType: string;
  createdAt: string;
}

const reportArtifactRegistry = new Map<string, ReportArtifactMeta>();
let registryLoaded = false;

async function loadRegistry(): Promise<void> {
  if (registryLoaded) {
    return;
  }
  registryLoaded = true;
  try {
    const { readFile } = await import("node:fs/promises");
    const data = await readFile(REGISTRY_FILE, "utf-8");
    const entries = JSON.parse(data) as ReportArtifactMeta[];
    for (const entry of entries) {
      reportArtifactRegistry.set(entry.reportId, entry);
    }
  } catch {
    // File doesn't exist yet or is corrupt — start fresh
  }
}

async function saveRegistry(): Promise<void> {
  await mkdir(REPORT_ARTIFACTS_DIR, { recursive: true });
  const entries = Array.from(reportArtifactRegistry.values());
  const { writeFile: wf } = await import("node:fs/promises");
  await wf(REGISTRY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

loadRegistry();

export function getReportArtifact(reportId: string): ReportArtifactMeta | undefined {
  return reportArtifactRegistry.get(reportId);
}

const AUDIENCE_MAP: Record<string, Audience> = {
  admin: "executive",
  captain: "executive",
  chief_officer: "executive",
  chief_engineer: "technical",
  second_engineer: "technical",
  engineer: "technical",
  technician: "maintenance",
  maintenance: "maintenance",
  compliance_officer: "compliance",
  system: "technical",
};

const TIME_RANGE_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "1y": 365,
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  health: "Vessel Health Report",
  fleet_summary: "Fleet Summary Report",
  maintenance: "Maintenance Report",
  compliance: "Compliance Report",
  cost_summary: "Cost Summary Report",
};

function resolveAudience(userRole?: string, requestedAudience?: string): Audience {
  if (
    requestedAudience &&
    ["executive", "technical", "maintenance", "compliance"].includes(requestedAudience)
  ) {
    return requestedAudience as Audience;
  }
  if (userRole) {
    return AUDIENCE_MAP[userRole.toLowerCase()] || "technical";
  }
  return "technical";
}

function resolveTimeframeDays(timeRange?: string): number {
  if (!timeRange) {
    return 30;
  }
  return TIME_RANGE_DAYS[timeRange] || 30;
}

function formatReportAsText(
  reportType: string,
  audience: string,
  analysis: string,
  result: Record<string, unknown>,
  vesselId?: string
): string {
  const lines: string[] = [];
  const title = REPORT_TYPE_LABELS[reportType] || "Report";
  lines.push(`${"=".repeat(60)}`);
  lines.push(title.toUpperCase());
  lines.push(`${"=".repeat(60)}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Audience: ${audience}`);
  if (vesselId) {
    lines.push(`Vessel: ${vesselId}`);
  }
  lines.push(`Confidence: ${((result['confidence'] as number) * 100).toFixed(0)}%`);
  lines.push(`${"=".repeat(60)}\n`);
  lines.push(analysis);

  if (result['scenarios'] && Array.isArray(result['scenarios']) && result['scenarios'].length > 0) {
    lines.push(`\n${"─".repeat(40)}`);
    lines.push("SCENARIO ANALYSIS");
    lines.push(`${"─".repeat(40)}`);
    for (const s of result['scenarios'] as Array<{
      scenario: string;
      probability: number;
      impact: string;
      recommendations: string[];
    }>) {
      lines.push(`\n▸ ${s.scenario}`);
      lines.push(`  Probability: ${(s.probability * 100).toFixed(0)}% | Impact: ${s.impact}`);
      if (s.recommendations?.length) {
        lines.push(`  Recommendations:`);
        for (const r of s.recommendations) {
          lines.push(`    • ${r}`);
        }
      }
    }
  }

  if (result['roi']) {
    const roi = result['roi'] as {
      estimatedSavings: number;
      investmentRequired: number;
      paybackPeriod: number;
      riskReduction: number;
    };
    lines.push(`\n${"─".repeat(40)}`);
    lines.push("ROI ANALYSIS");
    lines.push(`${"─".repeat(40)}`);
    lines.push(`  Estimated Savings: $${roi.estimatedSavings.toLocaleString()}`);
    lines.push(`  Investment Required: $${roi.investmentRequired.toLocaleString()}`);
    lines.push(`  Payback Period: ${roi.paybackPeriod} months`);
    lines.push(`  Risk Reduction: ${(roi.riskReduction * 100).toFixed(0)}%`);
  }

  if (
    result['referenceDocuments'] &&
    Array.isArray(result['referenceDocuments']) &&
    result['referenceDocuments'].length > 0
  ) {
    lines.push(`\n${"─".repeat(40)}`);
    lines.push("REFERENCE DOCUMENTS");
    lines.push(`${"─".repeat(40)}`);
    for (const ref of result['referenceDocuments'] as Array<{
      ref: string;
      document: string;
      relevance: string;
      excerpt: string;
    }>) {
      lines.push(`\n${ref.ref} ${ref.document} (relevance: ${ref.relevance})`);
      lines.push(`   ${ref.excerpt}`);
    }
  }

  return lines.join("\n");
}

async function generatePdfBuffer(
  reportType: string,
  audience: string,
  analysis: string,
  result: Record<string, unknown>,
  vesselId?: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const title = REPORT_TYPE_LABELS[reportType] || "Report";

    doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#666666");
    doc.text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    doc.text(`Audience: ${audience}`, { align: "center" });
    if (vesselId) {
      doc.text(`Vessel: ${vesselId}`, { align: "center" });
    }
    doc.text(`Confidence: ${((result['confidence'] as number) * 100).toFixed(0)}%`, {
      align: "center",
    });

    doc.moveDown(1);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke("#cccccc");
    doc.moveDown(1);

    doc.fontSize(11).font("Helvetica").fillColor("#000000");
    const paragraphs = analysis.split("\n");
    for (const p of paragraphs) {
      if (p.trim()) {
        doc.text(p.trim(), { align: "left", lineGap: 3 });
        doc.moveDown(0.3);
      }
    }

    if (result['scenarios'] && Array.isArray(result['scenarios']) && result['scenarios'].length > 0) {
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Scenario Analysis");
      doc.moveDown(0.5);
      for (const s of result['scenarios'] as Array<{
        scenario: string;
        probability: number;
        impact: string;
        recommendations: string[];
      }>) {
        doc.fontSize(11).font("Helvetica-Bold").text(`▸ ${s.scenario}`);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`  Probability: ${(s.probability * 100).toFixed(0)}% | Impact: ${s.impact}`);
        if (s.recommendations?.length) {
          for (const r of s.recommendations) {
            doc.text(`    • ${r}`);
          }
        }
        doc.moveDown(0.5);
      }
    }

    if (result['roi']) {
      const roi = result['roi'] as {
        estimatedSavings: number;
        investmentRequired: number;
        paybackPeriod: number;
        riskReduction: number;
      };
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("ROI Analysis");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Estimated Savings: $${roi.estimatedSavings.toLocaleString()}`);
      doc.text(`Investment Required: $${roi.investmentRequired.toLocaleString()}`);
      doc.text(`Payback Period: ${roi.paybackPeriod} months`);
      doc.text(`Risk Reduction: ${(roi.riskReduction * 100).toFixed(0)}%`);
    }

    if (
      result['referenceDocuments'] &&
      Array.isArray(result['referenceDocuments']) &&
      result['referenceDocuments'].length > 0
    ) {
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Reference Documents");
      doc.moveDown(0.5);
      for (const ref of result['referenceDocuments'] as Array<{
        ref: string;
        document: string;
        relevance: string;
        excerpt: string;
      }>) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(`${ref.ref} ${ref.document} (relevance: ${ref.relevance})`);
        doc.fontSize(10).font("Helvetica").text(`   ${ref.excerpt}`);
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

function convertToCSV(data: Record<string, unknown>): string {
  const rows: string[] = [];
  rows.push("Field,Value");
  rows.push(`Report Type,${data['reportType'] || ""}`);
  rows.push(`Audience,${data['audience'] || ""}`);
  rows.push(`Generated At,${data['generatedAt'] || ""}`);
  rows.push(`Confidence,${data['confidence'] || ""}`);
  if (data['vesselId']) {
    rows.push(`Vessel ID,${data['vesselId']}`);
  }
  rows.push("");
  rows.push("Section,Content");
  const analysis = String(data['analysis'] || "");
  const lines = analysis.split("\n");
  for (const line of lines) {
    rows.push(`Analysis,"${line.replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}

async function storeReportArtifact(
  reportId: string,
  orgId: string,
  userId: string | undefined,
  reportType: string,
  content: string,
  jsonData: Record<string, unknown>,
  format: string,
  pdfBuffer?: Buffer
): Promise<{ filePath: string; fileName: string }> {
  await mkdir(REPORT_ARTIFACTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let fileName: string;
  let filePath: string;

  if (format === "pdf" && pdfBuffer) {
    fileName = `report-${timestamp}-${reportId}.pdf`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    await writeFile(filePath, pdfBuffer);
  } else if (format === "json") {
    fileName = `report-${timestamp}-${reportId}.json`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    await writeFile(filePath, JSON.stringify(jsonData, null, 2), "utf-8");
  } else if (format === "csv") {
    fileName = `report-${timestamp}-${reportId}.csv`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    const csvContent = convertToCSV(jsonData);
    await writeFile(filePath, csvContent, "utf-8");
  } else {
    fileName = `report-${timestamp}-${reportId}.txt`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    await writeFile(filePath, content, "utf-8");
  }

  const meta: ReportArtifactMeta = {
    reportId,
    orgId,
    userId,
    fileName,
    filePath,
    format,
    reportType,
    createdAt: new Date().toISOString(),
  };
  reportArtifactRegistry.set(reportId, meta);
  await saveRegistry();

  return { filePath, fileName };
}

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
        response['scenarios'] = result.scenarios;
      }
      if (result.roi) {
        response['roi'] = result.roi;
      }
      if (result.citations && result.citations.length > 0) {
        response['citations'] = result.citations.slice(0, 5);
      }
      if (vesselId) {
        response['vesselId'] = vesselId;
      }

      if (ctx.knowledgeBase) {
        try {
          const kbQuery = `${reportType} ${vesselId ? `vessel ${vesselId}` : "fleet"} reference documentation`;
          const kbResult = await ctx.knowledgeBase.search(ctx.orgId, kbQuery, { maxSources: 3 });
          if (!kbResult.error && kbResult.citations.length > 0) {
            response['referenceDocuments'] = kbResult.citations.map((c, i) => ({
              ref: `[${i + 1}]`,
              document: c.docName,
              relevance: `${(c.relevance * 100).toFixed(0)}%`,
              excerpt: c.text.length > 150 ? `${c.text.slice(0, 150)}...` : c.text,
            }));
          }
        } catch (err) {
          logger.warn("[Agent] KB enrichment query failed:", { details: err instanceof Error ? err.message : "unknown" });
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
        response['artifact'] = {
          fileName: artifact.fileName,
          format: artifactFormat,
          downloadUrl: `/api/agent/reports/${reportId}/download`,
        };
        response['downloadAvailable'] = true;
      } catch (artifactErr) {
        response['artifactError'] =
          "Report generated successfully but file export failed. The report content is available inline above.";
      }

      response['previewCard'] = {
        title: reportLabel,
        subtitle: vesselId ? `Vessel: ${vesselId}` : "Fleet-wide",
        audience,
        confidence: result.confidence,
        generatedAt: response['generatedAt'],
        hasDownload: !!response['artifact'],
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

    const artifact = reportArtifactRegistry.get(reportId);
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
