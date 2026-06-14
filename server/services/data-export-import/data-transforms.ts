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

// Writing an arbitrary string key on a generic `T extends MutableRecord` otherwise
// needs a cast at every call site; funnel those index writes through one typed
// helper (T is assignable to MutableRecord, so no cast is needed here).
function setField(record: MutableRecord, field: string, value: unknown): void {
  record[field] = value;
}

export function convertDates<T extends MutableRecord>(record: T): T {
  for (const field of DATE_FIELDS) {
    const value = record[field];

    if (value === null || value === undefined || value === "") {
      setField(record, field, null);
      continue;
    }

    if (value instanceof Date) {
      continue;
    }

    if (typeof value === "string") {
      try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          setField(record, field, date);
        } else {
          setField(record, field, null);
        }
      } catch {
        setField(record, field, null);
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

  if (record["orgId"] === sourceOrgId) {
    setField(record, "orgId", targetOrgId);
  }

  if (record["org_id"] === sourceOrgId) {
    setField(record, "org_id", targetOrgId);
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
        setField(record, fieldName, newId);
      } else {
        logger.info(
          `[DataImport] FK remap ${entityName}.${fieldName}: ${oldId} → NULL (not in export)`
        );
        setField(record, fieldName, null);
        if (fieldName === "vesselId") {
          setField(record, "vesselName", null);
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
