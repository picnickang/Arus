/**
 * Import Service
 *
 * Core import orchestration for data imports with cross-org support.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

import { dbUserStorage } from "../../repositories";
import { ENTITY_EXPORT_ORDER, TELEMETRY_ENTITIES } from "./constants";
import type { ExportManifest, ImportResult, ImportOptions, IdMappings } from "./types";
import { extractArchive, validateFilePath } from "./archive-utils";
import { validateManifest } from "./manifest-validation";
import { convertDates, remapOrgId, remapForeignKeys, createIdMappings } from "./data-transforms";
import { upsertRecord } from "./entity-upserters";

function generateImportId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const random = randomUUID().slice(0, 8);
  return `import-${timestamp}-${random}`;
}

async function ensureTargetOrg(targetOrgId: string, sourceOrgId: string): Promise<void> {
  const targetOrg = await dbUserStorage.getOrganization(targetOrgId);
  if (targetOrg) {
    return;
  }

  console.log(`[DataImport] Creating target organization: ${targetOrgId}`);
  const slug = targetOrgId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  await dbUserStorage.createOrganization({
    name: `Imported from ${sourceOrgId}`,
    slug,
    maxUsers: 100,
    maxEquipment: 1000,
    subscriptionTier: "basic",
  } as any);
}

async function importEntityFile(
  entity: string,
  filePath: string,
  extractPath: string,
  targetOrgId: string,
  sourceOrgId: string,
  conflictResolution: "skip" | "upsert" | "replace",
  dryRun: boolean,
  idMappings: IdMappings,
  errors: string[],
  warnings: string[]
): Promise<number> {
  if (!validateFilePath(filePath, extractPath)) {
    errors.push(`Path traversal attempt detected for ${entity}`);
    return 0;
  }

  if (!fs.existsSync(filePath)) {
    warnings.push(`File not found for ${entity}`);
    return 0;
  }

  try {
    return await importEntity(
      entity,
      filePath,
      targetOrgId,
      sourceOrgId,
      conflictResolution,
      dryRun,
      idMappings
    );
  } catch (error) {
    errors.push(`Failed to import ${entity}: ${error}`);
    return 0;
  }
}

async function importTelemetryChunks(
  entity: string,
  entityManifest: { chunked?: boolean; files?: string[] },
  extractPath: string,
  targetOrgId: string,
  sourceOrgId: string,
  conflictResolution: "skip" | "upsert" | "replace",
  dryRun: boolean,
  idMappings: IdMappings,
  errors: string[]
): Promise<number> {
  let totalCount = 0;

  for (const chunkFile of entityManifest.files ?? []) {
    const chunkPath = path.join(extractPath, chunkFile);

    if (!validateFilePath(chunkPath, extractPath)) {
      errors.push(`Path traversal attempt detected: ${chunkFile}`);
      continue;
    }

    if (!fs.existsSync(chunkPath)) {
      continue;
    }

    try {
      totalCount += await importEntity(
        entity,
        chunkPath,
        targetOrgId,
        sourceOrgId,
        conflictResolution,
        dryRun,
        idMappings
      );
    } catch (error) {
      errors.push(`Failed to import telemetry chunk ${chunkFile}: ${error}`);
    }
  }

  return totalCount;
}

export async function importData(
  exportDir: string,
  archivePath: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const startTime = Date.now();
  const importId = generateImportId();
  const extractPath = path.join(exportDir, `import-${importId}`);
  const entitiesImported: Record<string, number> = {};
  const warnings: string[] = [];
  const errors: string[] = [];
  const idMappings = createIdMappings();

  try {
    console.log(`[DataImport] Starting import from: ${archivePath}`);
    await extractArchive(archivePath, extractPath);

    const manifestPath = path.join(extractPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("Invalid export: manifest.json not found");
    }

    const manifest: ExportManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Manifest validation failed: ${validation.error}`);
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings);
    }

    const targetOrgId = options.targetOrgId ?? manifest.scope.orgId;
    const conflictResolution = options.conflictResolution ?? "upsert";
    const isRemapping = manifest.scope.orgId !== targetOrgId;

    if (options.targetOrgId) {
      await ensureTargetOrg(options.targetOrgId, manifest.scope.orgId);
    }

    if (options.dryRun) {
      console.log(`[DataImport] Dry run - no changes will be made`);
    }
    if (isRemapping) {
      console.log(`[DataImport] Cross-org import: ${manifest.scope.orgId} → ${targetOrgId}`);
    }

    for (const entity of ENTITY_EXPORT_ORDER) {
      const entityManifest = manifest.entities[entity];
      if (!entityManifest) {
        continue;
      }

      const filePath = path.join(extractPath, entityManifest.file);
      entitiesImported[entity] = await importEntityFile(
        entity,
        filePath,
        extractPath,
        targetOrgId,
        manifest.scope.orgId,
        conflictResolution,
        options.dryRun || false,
        idMappings,
        errors,
        warnings
      );
    }

    if (!options.skipTelemetry) {
      for (const entity of TELEMETRY_ENTITIES) {
        const entityManifest = manifest.entities[entity];
        if (!entityManifest?.chunked) {
          continue;
        }

        entitiesImported[entity] = await importTelemetryChunks(
          entity,
          entityManifest,
          extractPath,
          targetOrgId,
          manifest.scope.orgId,
          conflictResolution,
          options.dryRun || false,
          idMappings,
          errors
        );
      }
    }

    if (isRemapping) {
      console.log(`[DataImport] ID mappings created:`, {
        vessels: idMappings.vessels.size,
        equipment: idMappings.equipment.size,
        work_orders: idMappings.work_orders.size,
      });
    }

    fs.rmSync(extractPath, { recursive: true });
    const duration = Date.now() - startTime;
    console.log(`[DataImport] Import completed: ${importId} (${duration}ms)`);

    return { success: errors.length === 0, importId, entitiesImported, warnings, errors, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DataImport] Import failed:`, error);

    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true });
    }

    return {
      success: false,
      importId,
      entitiesImported,
      warnings,
      errors: [error instanceof Error ? error.message : String(error)],
      duration,
    };
  }
}

async function importEntity(
  entityName: string,
  filePath: string,
  targetOrgId: string,
  sourceOrgId: string,
  conflictResolution: "skip" | "upsert" | "replace",
  dryRun: boolean,
  idMappings: IdMappings
): Promise<number> {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
  const isRemapping = sourceOrgId !== targetOrgId;
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    try {
      let record = JSON.parse(line);
      const originalId = record.id;

      record = remapOrgId(record, sourceOrgId, targetOrgId);
      record = convertDates(record);
      if (isRemapping) {
        record = remapForeignKeys(entityName, record, idMappings);
      }

      if (!dryRun) {
        const newId = await upsertRecord(entityName, record, conflictResolution, isRemapping);

        if (isRemapping && newId && originalId !== newId && idMappings[entityName]) {
          idMappings[entityName].set(originalId, newId);
          console.log(`[DataImport] ID mapping ${entityName}: ${originalId} → ${newId}`);
        }
      }

      count++;
    } catch (error) {
      console.warn(`[DataImport] Failed to import ${entityName} record:`, error);
    }
  }

  console.log(`[DataImport] Imported ${entityName}: ${count} records${dryRun ? " (dry run)" : ""}`);
  return count;
}
