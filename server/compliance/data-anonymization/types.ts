/**
 * Data Anonymization Service - Type Definitions
 * GDPR/PDPA-compliant anonymization types
 */

export type AnonymizationLevel = "none" | "partial" | "full";

export interface AnonymizationConfig {
  level: AnonymizationLevel;
  preserveIds: boolean;
  preserveTimestamps: boolean;
  preserveTechnicalData: boolean;
  salt?: string;
}

export interface AnonymizationResult {
  originalFieldCount: number;
  anonymizedFieldCount: number;
  skippedFieldCount: number;
}

export interface AnonymizationReport {
  timestamp: string;
  config: {
    level: AnonymizationLevel;
    preserveIds: boolean;
    preserveTimestamps: boolean;
    preserveTechnicalData: boolean;
  };
  summary: {
    totalFields: number;
    anonymizedFields: number;
    skippedFields: number;
    anonymizationRate: string;
  };
  entityBreakdown: Record<string, AnonymizationResult>;
  saltHash: string;
}
