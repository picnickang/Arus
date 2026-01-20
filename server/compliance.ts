/**
 * Compliance Bundle System for Maritime Regulatory Reporting
 * 
 * MODULARIZED: This file now re-exports from ./compliance/ modules
 * Original: 672 lines → Split into 6 focused modules (~25-190 lines each)
 */

export type {
  ComplianceStandard,
  ComplianceAssessment,
  ComplianceReport,
} from "./compliance/types";

export { MARITIME_STANDARDS } from "./compliance/standards";

export {
  assessCompliance,
  generateTelemetryAnalysis,
} from "./compliance/assessment";

export { generateComplianceReport } from "./compliance/report-generator";

export { generateHTMLReport } from "./compliance/html-renderer";

export { saveComplianceBundle } from "./compliance/bundle-service";
