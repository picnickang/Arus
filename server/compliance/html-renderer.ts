/**
 * Compliance HTML Renderer - Generates HTML compliance reports
 */

import type { ComplianceReport } from "./types";

/**
 * Generate HTML compliance report
 */
export function generateHTMLReport(report: ComplianceReport): string {
  const complianceRate =
    report.assessments.length > 0
      ? (report.assessments.filter((a) => a.overallStatus === "compliant").length /
          report.assessments.length) *
        100
      : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .vessel-info { background: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .compliance-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: white; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2563eb; }
        .metric-label { color: #64748b; margin-top: 5px; }
        .assessment-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .assessment-table th, .assessment-table td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
        .assessment-table th { background: #f1f5f9; font-weight: bold; }
        .status-compliant { background: #dcfce7; color: #16a34a; padding: 4px 8px; border-radius: 3px; }
        .status-conditional { background: #fef3c7; color: #d97706; padding: 4px 8px; border-radius: 3px; }
        .status-non-compliant { background: #fecaca; color: #dc2626; padding: 4px 8px; border-radius: 3px; }
        .recommendations { background: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0; }
        .signature { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; }
        .print-date { color: #64748b; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p class="print-date">Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="vessel-info">
        <h2>Vessel Information</h2>
        <table style="width: 100%;">
            <tr><td><strong>Vessel Name:</strong></td><td>${report.vessel.name}</td></tr>
            <tr><td><strong>IMO Number:</strong></td><td>${report.vessel.imoNumber}</td></tr>
            <tr><td><strong>Flag:</strong></td><td>${report.vessel.flag}</td></tr>
            <tr><td><strong>Classification Society:</strong></td><td>${report.vessel.classificationSociety}</td></tr>
            <tr><td><strong>Owner:</strong></td><td>${report.vessel.owner}</td></tr>
        </table>
    </div>

    <div class="compliance-summary">
        <div class="metric-card">
            <div class="metric-value">${complianceRate.toFixed(1)}%</div>
            <div class="metric-label">Overall Compliance</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.telemetryAnalysis.totalReadings.toLocaleString()}</div>
            <div class="metric-label">Telemetry Readings</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.telemetryAnalysis.equipmentAvailability}%</div>
            <div class="metric-label">Equipment Availability</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.assessments.length}</div>
            <div class="metric-label">Standards Assessed</div>
        </div>
    </div>

    <h2>Compliance Assessments</h2>
    <table class="assessment-table">
        <thead>
            <tr>
                <th>Equipment</th>
                <th>Standard</th>
                <th>Status</th>
                <th>Assessment Date</th>
                <th>Valid Until</th>
                <th>Certificate</th>
            </tr>
        </thead>
        <tbody>
            ${report.assessments
              .map(
                (assessment) => `
                <tr>
                    <td>${assessment.equipmentId}</td>
                    <td>${assessment.standardCode}</td>
                    <td><span class="status-${assessment.overallStatus.replace("_", "-")}">${assessment.overallStatus.replace("_", " ").toUpperCase()}</span></td>
                    <td>${assessment.assessmentDate.toLocaleDateString()}</td>
                    <td>${assessment.validUntil ? assessment.validUntil.toLocaleDateString() : "N/A"}</td>
                    <td>${assessment.certificateNumber || "N/A"}</td>
                </tr>
            `
              )
              .join("")}
        </tbody>
    </table>

    ${
      report.recommendations.length > 0
        ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations
              .map(
                (rec) => `
                <li><strong>${rec.priority.toUpperCase()}:</strong> ${rec.description}
                ${rec.deadline ? ` (Deadline: ${rec.deadline.toLocaleDateString()})` : ""}
                ${rec.estimatedCost ? ` (Est. Cost: $${rec.estimatedCost.toLocaleString()})` : ""}
                </li>
            `
              )
              .join("")}
        </ul>
    </div>
    `
        : ""
    }

    <div class="signature">
        <h2>Digital Signature</h2>
        <p><strong>Inspector:</strong> ${report.signature.inspector}</p>
        <p><strong>Certification:</strong> ${report.signature.inspectorCertification}</p>
        <p><strong>Date:</strong> ${report.signature.date.toLocaleDateString()}</p>
        <p><strong>Digital Signature:</strong> ${report.signature.digitalSignature}</p>
    </div>
</body>
</html>`;
}
