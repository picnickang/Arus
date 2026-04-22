/**
 * Export Service
 * 
 * Core export orchestration for org-scoped data exports.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";

import { isVesselMode } from "../../config/runtimeEnv";
import {
  DataAnonymizationService,
  AnonymizationConfig,
  AnonymizationResult
} from "../../compliance/data-anonymization.service";

import {
  CURRENT_EXPORT_VERSION,
  CURRENT_SCHEMA_VERSION,
  ENTITY_EXPORT_ORDER,
  TELEMETRY_ENTITIES,
} from "./constants";
import type {
  ExportManifest,
  ExportOptions,
  ExportResult,
  EntityExportResult,
} from "./types";
import { fetchEntityData } from "./entity-fetchers";
import { createArchive } from "./archive-utils";
import { exportTelemetryChunked } from "./telemetry-export";

/**
 * Export all data for an organization
 */
export async function exportOrg(
  exportDir: string,
  orgId: string,
  options: Partial<ExportOptions> = {},
  exportedBy: string = "system"
): Promise<ExportResult> {
  const startTime = Date.now();
  const exportId = generateExportId();
  const exportPath = path.join(exportDir, exportId);

  const fullOptions: ExportOptions = {
    includeTelemetry: options.includeTelemetry ?? false,
    telemetryDays: options.telemetryDays ?? 30,
    includeKnowledgeBase: options.includeKnowledgeBase ?? true,
    includeAuditLogs: options.includeAuditLogs ?? false,
    anonymize: options.anonymize ?? "none",
    anonymizationConfig: options.anonymizationConfig,
  };

  const anonymizationService = fullOptions.anonymize !== "none"
    ? new DataAnonymizationService()
    : null;
  
  const anonymizationResults: Record<string, AnonymizationResult> = {};

  try {
    console.log(`[DataExport] Starting export for org: ${orgId}${fullOptions.anonymize !== "none" ? ` (anonymization: ${fullOptions.anonymize})` : ""}`);
    fs.mkdirSync(exportPath, { recursive: true });

    const manifest: ExportManifest = {
      exportVersion: CURRENT_EXPORT_VERSION,
      appVersion: process.env.npm_package_version || "1.0",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy,
      deploymentMode: isVesselMode ? "vessel" : "cloud",
      scope: {
        type: "org",
        orgId,
        vesselFilter: null,
      },
      entities: {},
      options: fullOptions,
    };

    for (const entity of ENTITY_EXPORT_ORDER) {
      const result = await exportEntity(entity, orgId, exportPath, fullOptions, anonymizationService);
      if (result.count > 0) {
        manifest.entities[entity] = { count: result.count, file: result.file };
        if (result.anonymizationResult) {
          anonymizationResults[entity] = result.anonymizationResult;
        }
      }
    }

    if (fullOptions.includeTelemetry) {
      for (const entity of TELEMETRY_ENTITIES) {
        const result = await exportTelemetryChunked(
          entity,
          orgId,
          exportPath,
          fullOptions.telemetryDays,
          fullOptions,
          anonymizationService
        );
        if (result.count > 0) {
          manifest.entities[entity] = {
            count: result.count,
            file: result.file,
            chunked: result.chunked,
            chunkSize: result.chunkSize,
            files: result.files
          };
          if (result.anonymizationResult) {
            anonymizationResults[entity] = result.anonymizationResult;
          }
        }
      }
    }

    if (anonymizationService && Object.keys(anonymizationResults).length > 0) {
      const anonymizationReport = anonymizationService.generateAnonymizationReport(
        anonymizationResults,
        {
          level: fullOptions.anonymize || "none",
          preserveIds: fullOptions.anonymizationConfig?.preserveIds ?? true,
          preserveTimestamps: fullOptions.anonymizationConfig?.preserveTimestamps ?? true,
          preserveTechnicalData: fullOptions.anonymizationConfig?.preserveTechnicalData ?? true,
          salt: anonymizationService.getSalt()
        }
      );
      
      const reportPath = path.join(exportPath, "anonymization-report.json");
      fs.writeFileSync(reportPath, JSON.stringify(anonymizationReport, null, 2));
      console.log(`[DataExport] Anonymization report: ${anonymizationReport.summary.anonymizationRate} of fields anonymized`);
    }

    const manifestPath = path.join(exportPath, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const archivePath = `${exportPath}.tar.gz`;
    await createArchive(exportPath, archivePath);

    fs.rmSync(exportPath, { recursive: true });

    const duration = Date.now() - startTime;
    console.log(`[DataExport] Export completed: ${exportId} (${duration}ms)`);

    return {
      success: true,
      exportId,
      filePath: archivePath,
      manifest,
      duration,
    };
  } catch {
    const duration = Date.now() - startTime;
    console.error(`[DataExport] Export failed:`, error);

    if (fs.existsSync(exportPath)) {
      fs.rmSync(exportPath, { recursive: true });
    }

    return {
      success: false,
      exportId,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

/**
 * Export a single entity to JSONL format with optional anonymization
 */
async function exportEntity(
  entityName: string,
  orgId: string,
  exportPath: string,
  options: ExportOptions,
  anonymizationService?: DataAnonymizationService | null
): Promise<EntityExportResult> {
  const filePath = path.join(exportPath, `${entityName}.jsonl`);
  const writeStream = createWriteStream(filePath);
  let count = 0;
  const totalAnonymizationResult: AnonymizationResult = {
    originalFieldCount: 0,
    anonymizedFieldCount: 0,
    skippedFieldCount: 0
  };

  try {
    const data = await fetchEntityData(entityName, orgId, options);

    const anonymizationConfig: AnonymizationConfig = anonymizationService
      ? {
          level: options.anonymize || "none",
          preserveIds: options.anonymizationConfig?.preserveIds ?? true,
          preserveTimestamps: options.anonymizationConfig?.preserveTimestamps ?? true,
          preserveTechnicalData: options.anonymizationConfig?.preserveTechnicalData ?? true,
          salt: anonymizationService.getSalt()
        }
      : {
          level: "none",
          preserveIds: true,
          preserveTimestamps: true,
          preserveTechnicalData: true
        };

    for (const record of data) {
      let outputRecord = record;
      
      if (anonymizationService && options.anonymize && options.anonymize !== "none") {
        const { record: anonymized, result } = anonymizationService.anonymizeRecord(
          record,
          entityName,
          anonymizationConfig
        );
        outputRecord = anonymized;
        totalAnonymizationResult.originalFieldCount += result.originalFieldCount;
        totalAnonymizationResult.anonymizedFieldCount += result.anonymizedFieldCount;
        totalAnonymizationResult.skippedFieldCount += result.skippedFieldCount;
      }
      
      writeStream.write(`${JSON.stringify(outputRecord)  }\n`);
      count++;
    }

    writeStream.end();
    await new Promise((resolve) => writeStream.on("finish", resolve));

    const anonymizationInfo = anonymizationService && options.anonymize !== "none"
      ? ` (anonymized: ${totalAnonymizationResult.anonymizedFieldCount} fields)`
      : "";
    console.log(`[DataExport] Exported ${entityName}: ${count} records${anonymizationInfo}`);

    return {
      count,
      file: `${entityName}.jsonl`,
      anonymizationResult: anonymizationService ? totalAnonymizationResult : undefined
    };
  } catch {
    console.warn(`[DataExport] Failed to export ${entityName}:`, error);
    writeStream.end();
    return { count: 0, file: `${entityName}.jsonl` };
  }
}

function generateExportId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const random = randomUUID().slice(0, 8);
  return `export-${timestamp}-${random}`;
}
