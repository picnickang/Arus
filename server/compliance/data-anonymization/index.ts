/**
 * Data Anonymization Service - Main Entry Point
 * Re-exports modular components for GDPR/PDPA compliance
 */

export type { AnonymizationLevel, AnonymizationConfig, AnonymizationResult, AnonymizationReport } from "./types.js";
export { PII_FIELDS, COMMON_PII_PATTERNS, PARTIAL_ANONYMIZE_FIELDS } from "./pii-fields.js";
export { DataAnonymizationService } from "./service.js";

import { DataAnonymizationService } from "./service.js";
export const dataAnonymizationService = new DataAnonymizationService();
