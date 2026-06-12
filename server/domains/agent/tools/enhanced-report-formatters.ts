import PDFDocument from "pdfkit";
import type { Audience } from "../../../enhanced-llm/types";

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

export const REPORT_TYPE_LABELS: Record<string, string> = {
  health: "Vessel Health Report",
  fleet_summary: "Fleet Summary Report",
  maintenance: "Maintenance Report",
  compliance: "Compliance Report",
  cost_summary: "Cost Summary Report",
};

export function resolveAudience(userRole?: string, requestedAudience?: string): Audience {
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

export function resolveTimeframeDays(timeRange?: string): number {
  if (!timeRange) {
    return 30;
  }
  return TIME_RANGE_DAYS[timeRange] || 30;
}

export function formatReportAsText(
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
  lines.push(`Confidence: ${((result["confidence"] as number) * 100).toFixed(0)}%`);
  lines.push(`${"=".repeat(60)}\n`);
  lines.push(analysis);

  if (result["scenarios"] && Array.isArray(result["scenarios"]) && result["scenarios"].length > 0) {
    lines.push(`\n${"─".repeat(40)}`);
    lines.push("SCENARIO ANALYSIS");
    lines.push(`${"─".repeat(40)}`);
    for (const s of result["scenarios"] as Array<{
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

  if (result["roi"]) {
    const roi = result["roi"] as {
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
    result["referenceDocuments"] &&
    Array.isArray(result["referenceDocuments"]) &&
    result["referenceDocuments"].length > 0
  ) {
    lines.push(`\n${"─".repeat(40)}`);
    lines.push("REFERENCE DOCUMENTS");
    lines.push(`${"─".repeat(40)}`);
    for (const ref of result["referenceDocuments"] as Array<{
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

export async function generatePdfBuffer(
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
    doc.text(`Confidence: ${((result["confidence"] as number) * 100).toFixed(0)}%`, {
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

    if (
      result["scenarios"] &&
      Array.isArray(result["scenarios"]) &&
      result["scenarios"].length > 0
    ) {
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Scenario Analysis");
      doc.moveDown(0.5);
      for (const s of result["scenarios"] as Array<{
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

    if (result["roi"]) {
      const roi = result["roi"] as {
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
      result["referenceDocuments"] &&
      Array.isArray(result["referenceDocuments"]) &&
      result["referenceDocuments"].length > 0
    ) {
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Reference Documents");
      doc.moveDown(0.5);
      for (const ref of result["referenceDocuments"] as Array<{
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

export function convertToCSV(data: Record<string, unknown>): string {
  const rows: string[] = [];
  rows.push("Field,Value");
  rows.push(`Report Type,${data["reportType"] || ""}`);
  rows.push(`Audience,${data["audience"] || ""}`);
  rows.push(`Generated At,${data["generatedAt"] || ""}`);
  rows.push(`Confidence,${data["confidence"] || ""}`);
  if (data["vesselId"]) {
    rows.push(`Vessel ID,${data["vesselId"]}`);
  }
  rows.push("");
  rows.push("Section,Content");
  const analysis = String(data["analysis"] || "");
  const lines = analysis.split("\n");
  for (const line of lines) {
    rows.push(`Analysis,"${line.replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}
