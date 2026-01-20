/**
 * Compliance Types - Type definitions for maritime regulatory compliance
 */

export interface ComplianceStandard {
  code: string;
  name: string;
  authority: "ABS" | "DNV" | "LR" | "CCS" | "BV";
  category: "machinery" | "structural" | "electrical" | "safety" | "environmental";
  requirements: Array<{
    id: string;
    description: string;
    mandatory: boolean;
    frequency: "continuous" | "daily" | "weekly" | "monthly" | "annual";
    measurementType:
      | "vibration"
      | "temperature"
      | "pressure"
      | "flow_rate"
      | "voltage"
      | "frequency"
      | "visual";
    thresholds: {
      warning?: number;
      critical?: number;
      unit?: string;
    };
  }>;
}

export interface ComplianceAssessment {
  equipmentId: string;
  standardCode: string;
  assessmentDate: Date;
  assessor: string;
  overallStatus: "compliant" | "non_compliant" | "conditional" | "pending";
  findings: Array<{
    requirementId: string;
    status: "pass" | "fail" | "na";
    evidence: string;
    measurementValue?: number;
    comments?: string;
    correctiveAction?: string;
  }>;
  nextAssessmentDate: Date;
  certificateNumber?: string;
  validUntil?: Date;
}

export interface ComplianceReport {
  bundleId: string;
  title: string;
  reportType: "full_survey" | "intermediate_survey" | "annual_survey" | "continuous_monitoring";
  vessel: {
    name: string;
    imoNumber: string;
    flag: string;
    classificationSociety: string;
    owner: string;
  };
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  standards: ComplianceStandard[];
  assessments: ComplianceAssessment[];
  telemetryAnalysis: {
    monitoringHours: number;
    totalReadings: number;
    anomaliesDetected: number;
    alertsGenerated: number;
    equipmentAvailability: number;
  };
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    category: "maintenance" | "upgrade" | "monitoring" | "training";
    description: string;
    estimatedCost?: number;
    deadline?: Date;
  }>;
  signature: {
    inspector: string;
    inspectorCertification: string;
    date: Date;
    digitalSignature?: string;
  };
}
