/**
 * Data Anonymization Service - Backward Compatible Shim
 * Re-exports from modular implementation for GDPR/PDPA compliance
 */

export type { AnonymizationLevel, AnonymizationConfig, AnonymizationResult, AnonymizationReport } from "./data-anonymization/index.js";
export { PII_FIELDS, COMMON_PII_PATTERNS, PARTIAL_ANONYMIZE_FIELDS, DataAnonymizationService, dataAnonymizationService } from "./data-anonymization/index.js";
