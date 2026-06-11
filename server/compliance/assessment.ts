/**
 * Compliance Assessment - Functions for assessing equipment compliance
 */

import type { Device, AlertNotification, EquipmentTelemetry } from "@shared/schema";
import type { ComplianceStandard, ComplianceAssessment, ComplianceReport } from "./types";

type Requirement = ComplianceStandard["requirements"][number];
type FindingStatus = "pass" | "fail" | "na";

function matchesMeasurementType(sensorType: string, measurementType: string): boolean {
  if (measurementType === "vibration") {
    return sensorType === "vibration";
  }
  if (measurementType === "temperature") {
    return sensorType === "temperature";
  }
  if (measurementType === "pressure") {
    return sensorType === "pressure";
  }
  if (measurementType === "flow_rate" || measurementType === "flow") {
    return sensorType === "flow_rate";
  }
  return false;
}

function filterRelevantReadings(
  telemetryData: EquipmentTelemetry[],
  measurementType: string
): EquipmentTelemetry[] {
  return telemetryData.filter((reading) =>
    matchesMeasurementType(reading.sensorType, measurementType)
  );
}

function filterRelevantAlerts(
  alerts: AlertNotification[],
  measurementType: string,
  equipmentId: string
): AlertNotification[] {
  return alerts.filter(
    (alert) => alert.alertType === measurementType && alert.equipmentId === equipmentId
  );
}

function evaluateThresholdStatus(
  avgValue: number,
  requirement: Requirement
): { status: FindingStatus; evidence: string; comments: string; correctiveAction: string } {
  const { warning, critical } = requirement.thresholds;
  const unit = requirement.thresholds.unit;
  const type = requirement.measurementType;

  if (critical === undefined) {
    return {
      status: "pass",
      evidence: `${type} monitoring active`,
      comments: "",
      correctiveAction: "",
    };
  }

  if (avgValue >= critical) {
    return {
      status: "fail",
      evidence: `Average ${type} of ${avgValue.toFixed(2)} ${unit} exceeds critical threshold of ${critical} ${unit}`,
      comments: "",
      correctiveAction: `Immediate maintenance required - ${type} exceeds safe operating limits`,
    };
  }

  if (warning !== undefined && avgValue >= warning) {
    return {
      status: "pass",
      evidence: `Average ${type} of ${avgValue.toFixed(2)} ${unit} is above warning threshold but below critical`,
      comments: "Monitor closely - approaching warning limits",
      correctiveAction: "",
    };
  }

  return {
    status: "pass",
    evidence: `Average ${type} of ${avgValue.toFixed(2)} ${unit} is within acceptable limits`,
    comments: "",
    correctiveAction: "",
  };
}

function checkRecentCriticalAlerts(relevantAlerts: AlertNotification[]): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return relevantAlerts.filter(
    // alert_notifications has no severity column; alertType acts as the severity discriminator.
    (alert) => alert.alertType === "critical" && (alert.createdAt?.getTime() ?? 0) > cutoff
  ).length;
}

function evaluateRequirement(
  requirement: Requirement,
  relevantReadings: EquipmentTelemetry[],
  relevantAlerts: AlertNotification[]
): ComplianceAssessment["findings"][number] {
  if (relevantReadings.length === 0) {
    const noDataResult = requirement.mandatory
      ? {
          status: "fail" as FindingStatus,
          evidence: "No telemetry data available for mandatory requirement",
          correctiveAction: "Install monitoring sensors and establish data collection",
        }
      : {
          status: "na" as FindingStatus,
          evidence: "No data available - not applicable for this equipment type",
          correctiveAction: "",
        };
    return {
      requirementId: requirement.id,
      status: noDataResult.status,
      evidence: noDataResult.evidence,
      measurementValue: undefined,
      comments: "",
      correctiveAction: noDataResult.correctiveAction || undefined,
    };
  }

  const recentReadings = relevantReadings.slice(-100);
  const avgValue = recentReadings.reduce((sum, r) => sum + r.value, 0) / recentReadings.length;
  const measurementValue = Math.round(avgValue * 100) / 100;

  let result = evaluateThresholdStatus(avgValue, requirement);
  const criticalAlertCount = checkRecentCriticalAlerts(relevantAlerts);

  if (criticalAlertCount > 0) {
    result = {
      ...result,
      status: "fail",
      evidence: `${result.evidence} | ${criticalAlertCount} critical alerts in last 24 hours`,
      correctiveAction: "Investigate and resolve critical alerts before survey completion",
    };
  }

  return {
    requirementId: requirement.id,
    status: result.status,
    evidence: result.evidence,
    measurementValue,
    comments: result.comments,
    correctiveAction: result.correctiveAction || undefined,
  };
}

function determineOverallStatus(complianceRate: number): ComplianceAssessment["overallStatus"] {
  if (complianceRate >= 1) {
    return "compliant";
  }
  if (complianceRate >= 0.8) {
    return "conditional";
  }
  return "non_compliant";
}

function assessStandard(
  equipment: Device,
  standard: ComplianceStandard,
  telemetryData: EquipmentTelemetry[],
  alerts: AlertNotification[]
): ComplianceAssessment {
  const findings: ComplianceAssessment["findings"] = [];
  let passCount = 0;

  for (const requirement of standard.requirements) {
    const relevantReadings = filterRelevantReadings(telemetryData, requirement.measurementType);
    const relevantAlerts = filterRelevantAlerts(alerts, requirement.measurementType, equipment.id);
    const finding = evaluateRequirement(requirement, relevantReadings, relevantAlerts);
    findings.push(finding);
    if (finding.status === "pass") {
      passCount++;
    }
  }

  const complianceRate = passCount / standard.requirements.length;
  const overallStatus = determineOverallStatus(complianceRate);
  const nextAssessmentDate = new Date();
  nextAssessmentDate.setMonth(nextAssessmentDate.getMonth() + 12);

  return {
    equipmentId: equipment.id,
    standardCode: standard.code,
    assessmentDate: new Date(),
    assessor: "ARUS Automated Assessment System",
    overallStatus,
    findings,
    nextAssessmentDate,
    certificateNumber:
      overallStatus === "compliant" ? `ARUS-${Date.now()}-${equipment.id}` : undefined,
    validUntil: overallStatus === "compliant" ? nextAssessmentDate : undefined,
  };
}

/**
 * Assess equipment compliance against specific standards
 */
export function assessCompliance(
  equipment: Device,
  standards: ComplianceStandard[],
  telemetryData: EquipmentTelemetry[],
  alerts: AlertNotification[]
): ComplianceAssessment[] {
  return standards.map((standard) => assessStandard(equipment, standard, telemetryData, alerts));
}

/**
 * Generate telemetry analysis summary for compliance reporting
 */
export function generateTelemetryAnalysis(
  equipmentIds: string[],
  telemetryData: EquipmentTelemetry[],
  alerts: AlertNotification[],
  period: { startDate: Date; endDate: Date }
): ComplianceReport["telemetryAnalysis"] {
  const periodData = telemetryData.filter((reading) => {
    return (
      reading.ts >= period.startDate &&
      reading.ts <= period.endDate &&
      equipmentIds.includes(reading.equipmentId)
    );
  });

  const periodAlerts = alerts.filter((alert) => {
    if (!alert.createdAt) {
      return false;
    }
    return (
      alert.createdAt >= period.startDate &&
      alert.createdAt <= period.endDate &&
      equipmentIds.includes(alert.equipmentId)
    );
  });

  const uniqueTimestamps = new Set(periodData.map((r) => r.ts.getTime()));
  const monitoringHours = (uniqueTimestamps.size * 5) / 60;

  const periodHours = (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60);
  const expectedReadings = equipmentIds.length * (periodHours * 12);
  const equipmentAvailability = Math.min(100, (periodData.length / expectedReadings) * 100);

  const anomalousReadings = periodData.filter((reading) => {
    return periodAlerts.some(
      (alert) =>
        alert.createdAt !== null &&
        Math.abs(alert.createdAt.getTime() - reading.ts.getTime()) < 5 * 60 * 1000
    );
  });

  return {
    monitoringHours: Math.round(monitoringHours),
    totalReadings: periodData.length,
    anomaliesDetected: anomalousReadings.length,
    alertsGenerated: periodAlerts.length,
    equipmentAvailability: Math.round(equipmentAvailability * 100) / 100,
  };
}
