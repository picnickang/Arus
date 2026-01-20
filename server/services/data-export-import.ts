/**
 * Data Export/Import Service for ARUS
 * 
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been modularized into server/services/data-export-import/
 * This shim re-exports all functionality for backward compatibility.
 * 
 * New code should import from:
 * - './data-export-import/index.js' for all exports
 * - './data-export-import/types.js' for types only
 * - './data-export-import/export-service.js' for export functions
 * - './data-export-import/import-service.js' for import functions
 * 
 * ============================================================================
 * UPGRADE SAFETY NOTES (Phase 5)
 * ============================================================================
 * 
 * When making schema changes:
 * 
 * 1. UPDATE SCHEMA VERSION
 *    - Increment CURRENT_SCHEMA_VERSION when making breaking changes
 *    - Format: "YYYY-MM-DD" (e.g., "2025-11-26")
 * 
 * 2. ADD DATA TRANSFORMS
 *    - For older exports, add transform logic to handle missing/renamed fields
 *    - See convertDates() and remapForeignKeys() for examples
 * 
 * 3. ENTITY ORDER MATTERS
 *    - ENTITY_EXPORT_ORDER determines import sequence
 *    - Parent entities must come before children (vessels → equipment → work_orders)
 *    - Adding new entities? Insert in correct dependency order
 * 
 * 4. FK RELATIONSHIPS
 *    - Update fkMappings in remapForeignKeys() when adding new FK columns
 *    - Ensure parent entity is in ENTITY_EXPORT_ORDER before child
 * 
 * 5. DATE FIELDS
 *    - Add new date fields to dateFields array in convertDates()
 *    - Use camelCase (e.g., 'plannedStartDate', not 'planned_start_date')
 * 
 * 6. STORAGE LAYER
 *    - Use storage.createX(record) with provided IDs for imports
 *    - Never use raw SQL - go through storage abstraction
 * 
 * See docs/data-export-import.md for complete documentation.
 * ============================================================================
 */

export {
  // Types
  type ExportManifest,
  type EntityManifest,
  type ExportOptions,
  type ExportResult,
  type ImportResult,
  type ImportOptions,
  type EntityExportResult,
  type ManifestValidation,
  type IdMappings,
  type ExportListItem,
  type ConflictResolution,
  
  // Constants
  CURRENT_EXPORT_VERSION,
  CURRENT_SCHEMA_VERSION,
  TELEMETRY_CHUNK_SIZE,
  ENTITY_EXPORT_ORDER,
  TELEMETRY_ENTITIES,
  FK_MAPPINGS,
  DATE_FIELDS,
  
  // Service class
  DataExportImportService,
  getDataExportImportService,
  
  // Version exports
  SCHEMA_VERSION,
  EXPORT_VERSION,
  
  // Functions
  exportOrg,
  importData,
  listExports,
  deleteExport,
  ensureExportDir,
  fetchEntityData,
  upsertRecord,
  convertDates,
  remapOrgId,
  remapForeignKeys,
  createIdMappings,
  createArchive,
  extractArchive,
  validateFilePath,
  validateManifest,
} from "./data-export-import/index.js";
