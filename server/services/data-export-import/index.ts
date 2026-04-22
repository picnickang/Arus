/**
 * Data Export/Import Service
 *
 * Re-exports all modules and provides backward-compatible service class.
 */

export * from "./types";
export * from "./constants";
export * from "./data-transforms";
export * from "./archive-utils";
export * from "./manifest-validation";
export * from "./entity-fetchers";
export * from "./entity-upserters";
export * from "./export-service";
export * from "./import-service";
export * from "./file-management";
export * from "./telemetry-export";

import { exportOrg } from "./export-service";
import { importData } from "./import-service";
import { listExports, deleteExport, ensureExportDir } from "./file-management";
import { CURRENT_SCHEMA_VERSION, CURRENT_EXPORT_VERSION } from "./constants";
import type {
  ExportOptions,
  ExportResult,
  ImportResult,
  ImportOptions,
  ExportListItem,
} from "./types";

/**
 * DataExportImportService - backward-compatible wrapper class
 */
export class DataExportImportService {
  private exportDir: string;

  constructor(exportDir: string = "./data-exports") {
    this.exportDir = ensureExportDir(exportDir);
  }

  async exportOrg(
    orgId: string,
    options: Partial<ExportOptions> = {},
    exportedBy: string = "system"
  ): Promise<ExportResult> {
    return exportOrg(this.exportDir, orgId, options, exportedBy);
  }

  async importData(archivePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    return importData(this.exportDir, archivePath, options);
  }

  async listExports(): Promise<ExportListItem[]> {
    return listExports(this.exportDir);
  }

  async deleteExport(exportId: string): Promise<boolean> {
    return deleteExport(this.exportDir, exportId);
  }
}

let serviceInstance: DataExportImportService | null = null;

export function getDataExportImportService(): DataExportImportService {
  if (!serviceInstance) {
    serviceInstance = new DataExportImportService();
  }
  return serviceInstance;
}

export const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
export const EXPORT_VERSION = CURRENT_EXPORT_VERSION;
