/**
 * Compliance Report Generator - Generates comprehensive compliance reports
 */

import type { ComplianceReport, ComplianceAssessment } from "./types";
import { MARITIME_STANDARDS } from "./standards";
import { assessCompliance, generateTelemetryAnalysis } from "./assessment";

/**
 * Generate comprehensive compliance report
 */
export async function generateComplianceReport(
  config: {
    bundleId: string;
    title: string;
    reportType: ComplianceReport["reportType"];
    vessel: ComplianceReport["vessel"];
    reportingPeriod: ComplianceReport["reportingPeriod"];
    equipmentIds: string[];
    standardCodes: string[];
  },
  storage: {
    getEquipment: (
      orgId: string,
      id: string
    ) => Promise<Parameters<typeof assessCompliance>[0] | undefined>;
    getTelemetryByPeriod: (
      equipmentIds: string[],
      start: Date,
      end: Date,
      orgId: string
    ) => Promise<Parameters<typeof assessCompliance>[2]>;
    getAlertsByPeriod: (
      equipmentIds: string[],
      start: Date,
      end: Date,
      orgId: string
    ) => Promise<Parameters<typeof assessCompliance>[3]>;
  },
  orgId: string
): Promise<ComplianceReport> {
  const standards = MARITIME_STANDARDS.filter((std) => config.standardCodes.includes(std.code));

  const equipment = await Promise.all(
    config.equipmentIds.map((id) => storage.getEquipment(orgId, id))
  );

  const telemetryData = await storage.getTelemetryByPeriod(
    config.equipmentIds,
    config.reportingPeriod.startDate,
    config.reportingPeriod.endDate,
    orgId
  );

  const alerts = await storage.getAlertsByPeriod(
    config.equipmentIds,
    config.reportingPeriod.startDate,
    config.reportingPeriod.endDate,
    orgId
  );

  const allAssessments: ComplianceAssessment[] = [];
  for (const eq of equipment) {
    if (eq) {
      const assessments = assessCompliance(eq, standards, telemetryData, alerts);
      allAssessments.push(...assessments);
    }
  }

  const telemetryAnalysis = generateTelemetryAnalysis(
    config.equipmentIds,
    telemetryData,
    alerts,
    config.reportingPeriod
  );

  const recommendations: ComplianceReport["recommendations"] = [];

  const nonCompliantAssessments = allAssessments.filter((a) => a.overallStatus === "non_compliant");
  for (const assessment of nonCompliantAssessments) {
    const failedFindings = assessment.findings.filter((f) => f.status === "fail");
    for (const finding of failedFindings) {
      if (finding.correctiveAction) {
        recommendations.push({
          priority: "high",
          category: "maintenance",
          description: finding.correctiveAction,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    }
  }

  const conditionalAssessments = allAssessments.filter((a) => a.overallStatus === "conditional");
  if (conditionalAssessments.length > 0) {
    recommendations.push({
      priority: "medium",
      category: "monitoring",
      description: `Enhanced monitoring recommended for ${conditionalAssessments.length} equipment items with conditional compliance`,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
  }

  if (telemetryAnalysis.equipmentAvailability < 95) {
    recommendations.push({
      priority: "low",
      category: "upgrade",
      description: `Improve sensor reliability - current equipment availability: ${telemetryAnalysis.equipmentAvailability}%`,
      estimatedCost: 15000,
    });
  }

  return {
    bundleId: config.bundleId,
    title: config.title,
    reportType: config.reportType,
    vessel: config.vessel,
    reportingPeriod: config.reportingPeriod,
    standards,
    assessments: allAssessments,
    telemetryAnalysis,
    recommendations,
    signature: {
      inspector: "ARUS Compliance System",
      inspectorCertification: "ARUS-CERT-2025",
      date: new Date(),
      digitalSignature: `ARUS-${Date.now()}-COMPLIANCE`,
    },
  };
}
