/**
 * Data Transforms
 *
 * Pure functions for transforming data during import:
 * - Date conversion
 * - Org ID remapping
 * - Foreign key remapping
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DataExportImport:DataTransforms");
import { FK_MAPPINGS, DATE_FIELDS } from "./constants";
import type { IdMappings } from "./types";

/**
 * Convert date strings back to Date objects, handling nulls and edge cases
 */
export type MutableRecord = Record<string, unknown>;

export function convertDates<T extends MutableRecord>(record: T): T {
  for (const field of DATE_FIELDS) {
    const value = record[field];

    if (value === null || value === undefined || value === "") {
      (record as MutableRecord)[field] = null;
      continue;
    }

    if (value instanceof Date) {
      continue;
    }

    if (typeof value === "string") {
      try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          (record as MutableRecord)[field] = date;
        } else {
          (record as MutableRecord)[field] = null;
        }
      } catch {
        (record as MutableRecord)[field] = null;
      }
    }
  }

  return record;
}

/**
 * Remap orgId from source to target organization
 */
export function remapOrgId<T extends MutableRecord>(
  record: T,
  sourceOrgId: string,
  targetOrgId: string
): T {
  if (sourceOrgId === targetOrgId) {
    return record;
  }

  if (record.orgId === sourceOrgId) {
    (record as MutableRecord).orgId = targetOrgId;
  }

  if (record.org_id === sourceOrgId) {
    (record as MutableRecord).org_id = targetOrgId;
  }

  return record;
}

/**
 * Remap foreign key references using ID mappings from previously imported entities
 */
export function remapForeignKeys<T extends MutableRecord>(
  entityName: string,
  record: T,
  idMappings: IdMappings
): T {
  const entityFks = FK_MAPPINGS[entityName];
  if (!entityFks) {
    return record;
  }

  for (const [fieldName, mappingSource] of Object.entries(entityFks)) {
    const oldId = record[fieldName];
    if (typeof oldId === "string" && oldId && idMappings[mappingSource]) {
      const newId = idMappings[mappingSource].get(oldId);
      if (newId) {
        logger.info(`[DataImport] FK remap ${entityName}.${fieldName}: ${oldId} → ${newId}`);
        (record as MutableRecord)[fieldName] = newId;
      } else {
        logger.info(`[DataImport] FK remap ${entityName}.${fieldName}: ${oldId} → NULL (not in export)`);
        (record as MutableRecord)[fieldName] = null;
        if (fieldName === "vesselId") {
          (record as MutableRecord).vesselName = null;
        }
      }
    }
  }

  return record;
}

/**
 * Create initial empty ID mappings structure
 */
export function createIdMappings(): IdMappings {
  return {
    vessels: new Map(),
    equipment: new Map(),
    work_orders: new Map(),
    maintenance_schedules: new Map(),
    sensors: new Map(),
  };
}
