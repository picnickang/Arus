/**
 * Compliance Module - Backward-compatible re-exports
 * 
 * This module provides maritime regulatory compliance functionality
 * including assessment, report generation, and bundle management.
 */

export type {
  ComplianceStandard,
  ComplianceAssessment,
  ComplianceReport,
} from "./types";

export { MARITIME_STANDARDS } from "./standards";

export {
  assessCompliance,
  generateTelemetryAnalysis,
} from "./assessment";

export { generateComplianceReport } from "./report-generator";

export { generateHTMLReport } from "./html-renderer";

export { saveComplianceBundle } from "./bundle-service";
