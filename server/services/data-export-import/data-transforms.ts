/**
 * Data Transforms
 * 
 * Pure functions for transforming data during import:
 * - Date conversion
 * - Org ID remapping
 * - Foreign key remapping
 */

import { FK_MAPPINGS, DATE_FIELDS } from "./constants";
import type { IdMappings } from "./types";

/**
 * Convert date strings back to Date objects, handling nulls and edge cases
 */
export function convertDates(record: any): any {
  for (const field of DATE_FIELDS) {
    const value = record[field];
    
    if (value === null || value === undefined || value === '') {
      record[field] = null;
      continue;
    }
    
    if (value instanceof Date) {
      continue;
    }
    
    if (typeof value === 'string') {
      try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          record[field] = date;
        } else {
          record[field] = null;
        }
      } catch {
        record[field] = null;
      }
    }
  }

  return record;
}

/**
 * Remap orgId from source to target organization
 */
export function remapOrgId(record: any, sourceOrgId: string, targetOrgId: string): any {
  if (sourceOrgId === targetOrgId) { return record; }

  if (record.orgId === sourceOrgId) {
    record.orgId = targetOrgId;
  }

  if (record.org_id === sourceOrgId) {
    record.org_id = targetOrgId;
  }

  return record;
}

/**
 * Remap foreign key references using ID mappings from previously imported entities
 */
export function remapForeignKeys(
  entityName: string,
  record: any,
  idMappings: IdMappings
): any {
  const entityFks = FK_MAPPINGS[entityName];
  if (!entityFks) { return record; }

  for (const [fieldName, mappingSource] of Object.entries(entityFks)) {
    const oldId = record[fieldName];
    if (oldId && idMappings[mappingSource]) {
      const newId = idMappings[mappingSource].get(oldId);
      if (newId) {
        console.log(`[DataImport] FK remap ${entityName}.${fieldName}: ${oldId} → ${newId}`);
        record[fieldName] = newId;
      } else {
        console.log(`[DataImport] FK remap ${entityName}.${fieldName}: ${oldId} → NULL (not in export)`);
        record[fieldName] = null;
        if (fieldName === 'vesselId') {
          record.vesselName = null;
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
