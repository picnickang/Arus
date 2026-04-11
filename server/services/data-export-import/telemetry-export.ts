/**
 * Telemetry Export
 * 
 * Chunked telemetry export with tenant isolation validation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createWriteStream } from "node:fs";

import { dbEquipmentStorage, dbTelemetryStorage } from "../../repositories";
import { DataAnonymizationService, AnonymizationConfig, AnonymizationResult } from "../../compliance/data-anonymization.service";

import { TELEMETRY_CHUNK_SIZE } from "./constants";
import type { ExportOptions, EntityExportResult } from "./types";

/**
 * Export telemetry data in chunks with tenant isolation validation
 */
export async function exportTelemetryChunked(
  entityName: string,
  orgId: string,
  exportPath: string,
  days: number,
  options?: ExportOptions,
  anonymizationService?: DataAnonymizationService | null
): Promise<EntityExportResult> {
  const telemetryDir = path.join(exportPath, "telemetry");
  fs.mkdirSync(telemetryDir, { recursive: true });

  const files: string[] = [];
  let totalCount = 0;
  let chunkNum = 1;
  const totalAnonymizationResult: AnonymizationResult = {
    originalFieldCount: 0,
    anonymizedFieldCount: 0,
    skippedFieldCount: 0
  };

  const anonymizationConfig: AnonymizationConfig | null = anonymizationService && options?.anonymize !== "none"
    ? {
        level: options?.anonymize || "none",
        preserveIds: options?.anonymizationConfig?.preserveIds ?? true,
        preserveTimestamps: options?.anonymizationConfig?.preserveTimestamps ?? true,
        preserveTechnicalData: false,
        salt: anonymizationService.getSalt()
      }
    : null;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allEquipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
    const equipmentIds = allEquipment.map((e) => e.id);
    const equipmentIdSet = new Set(equipmentIds);

    for (const equipmentId of equipmentIds) {
      let telemetry: any[] = [];

      if (entityName === "equipment_telemetry") {
        telemetry = await dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, 10000);
        telemetry = telemetry
          .filter((t) => t.ts && new Date(t.ts) >= cutoffDate)
          .filter((t) => equipmentIdSet.has(t.equipmentId))
          .filter((t) => t.orgId === orgId);
      }

      if (telemetry.length === 0) { continue; }

      for (let i = 0; i < telemetry.length; i += TELEMETRY_CHUNK_SIZE) {
        const chunk = telemetry.slice(i, i + TELEMETRY_CHUNK_SIZE);
        const chunkFile = `${entityName}_chunk_${String(chunkNum).padStart(3, "0")}.jsonl`;
        const chunkPath = path.join(telemetryDir, chunkFile);

        const writeStream = createWriteStream(chunkPath);
        let chunkWritten = 0;
        
        for (const record of chunk) {
          if (!equipmentIdSet.has(record.equipmentId)) {
            console.warn(`[DataExport] Skipping telemetry with non-org equipmentId: ${record.equipmentId}`);
            continue;
          }

          if (record.orgId !== orgId) {
            console.warn(`[DataExport] Skipping telemetry with non-matching orgId: ${record.orgId}`);
            continue;
          }
          
          let outputRecord = record;
          if (anonymizationService && anonymizationConfig) {
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
          chunkWritten++;
        }
        writeStream.end();
        await new Promise((resolve) => writeStream.on("finish", resolve));

        if (chunkWritten > 0) {
          files.push(`telemetry/${chunkFile}`);
          totalCount += chunkWritten;
          chunkNum++;
        } else {
          fs.unlinkSync(chunkPath);
        }
      }
    }

    const anonymizationInfo = anonymizationService && options?.anonymize !== "none"
      ? ` (anonymized: ${totalAnonymizationResult.anonymizedFieldCount} fields)`
      : "";
    console.log(`[DataExport] Exported ${entityName}: ${totalCount} records in ${files.length} chunks${anonymizationInfo}`);

    return {
      count: totalCount,
      file: `telemetry/${entityName}_chunk_001.jsonl`,
      chunked: true,
      chunkSize: TELEMETRY_CHUNK_SIZE,
      files,
      anonymizationResult: anonymizationService ? totalAnonymizationResult : undefined
    };
  } catch (error) {
    console.warn(`[DataExport] Failed to export telemetry ${entityName}:`, error);
    return { count: 0, file: "", chunked: true, files: [] };
  }
}
