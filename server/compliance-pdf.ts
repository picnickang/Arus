/**
 * Beast Mode: Compliance PDF Pod
 *
 * Maritime compliance report generation using pdf-lib
 * Leverages existing compliance infrastructure in server/compliance.ts
 *
 * MODULARIZED: 595 lines → 6 focused modules (~50-130 lines each)
 */

export type {
  ReportingPeriod,
  EquipmentComplianceOptions,
  MaintenanceComplianceOptions,
  RegulatoryFramework,
  CompliancePDFOptions,
  CompliancePDFResult,
} from "./compliance-pdf/types";

export { FRAMEWORK_STANDARDS } from "./compliance-pdf/types";
export { CompliancePDFGenerator } from "./compliance-pdf/index";
