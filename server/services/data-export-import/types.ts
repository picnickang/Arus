/**
 * Data Export/Import Types
 *
 * All interfaces and types for the data export/import service.
 */

import type {
  AnonymizationConfig,
  AnonymizationLevel,
  AnonymizationResult,
} from "../../compliance/data-anonymization.service";

export interface ExportManifest {
  exportVersion: number;
  appVersion: string;
  schemaVersion: string;
  exportedAt: string;
  exportedBy: string;
  deploymentMode: "cloud" | "vessel";
  scope: {
    type: "org" | "vessel";
    orgId: string;
    vesselFilter?: string | null;
  };
  entities: Record<string, EntityManifest>;
  options: ExportOptions;
  checksum?: string;
}

export interface EntityManifest {
  count: number;
  file: string;
  chunked?: boolean | undefined;
  chunkSize?: number | undefined;
  files?: string[] | undefined;
}

export interface ExportOptions {
  includeTelemetry: boolean;
  telemetryDays: number;
  includeKnowledgeBase: boolean;
  includeAuditLogs: boolean;
  anonymize?: AnonymizationLevel | undefined;
  anonymizationConfig?: Partial<AnonymizationConfig> | undefined;
}

export interface ExportResult {
  success: boolean;
  exportId: string;
  filePath?: string;
  manifest?: ExportManifest;
  error?: string;
  duration: number;
}

export interface ImportResult {
  success: boolean;
  importId: string;
  entitiesImported: Record<string, number>;
  warnings: string[];
  errors: string[];
  duration: number;
}

export interface ImportOptions {
  targetOrgId?: string;
  dryRun?: boolean;
  skipTelemetry?: boolean;
  conflictResolution?: "skip" | "upsert" | "replace";
}

export interface EntityExportResult extends EntityManifest {
  anonymizationResult?: AnonymizationResult | undefined;
}

export interface ManifestValidation {
  valid: boolean;
  error?: string | undefined;
  warnings?: string[] | undefined;
}

export interface IdMappings {
  vessels: Map<string, string>;
  equipment: Map<string, string>;
  work_orders: Map<string, string>;
  maintenance_schedules: Map<string, string>;
  sensors: Map<string, string>;
  [key: string]: Map<string, string>;
}

export interface ExportListItem {
  id: string;
  path: string;
  createdAt: Date;
  size: number;
}

export type ConflictResolution = "skip" | "upsert" | "replace";
