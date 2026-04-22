/**
 * Manifest Validation
 *
 * Functions for validating export manifests during import.
 */

import { CURRENT_EXPORT_VERSION, CURRENT_SCHEMA_VERSION } from "./constants";
import type { ExportManifest, ManifestValidation } from "./types";

/**
 * Validate export manifest with strict schema version checking
 */
export function validateManifest(manifest: ExportManifest): ManifestValidation {
  const warnings: string[] = [];

  if (!manifest.exportVersion) {
    return { valid: false, error: "Missing exportVersion" };
  }

  if (manifest.exportVersion > CURRENT_EXPORT_VERSION) {
    return {
      valid: false,
      error: `Export version ${manifest.exportVersion} is newer than supported version ${CURRENT_EXPORT_VERSION}. Please upgrade the application before importing.`,
    };
  }

  if (manifest.exportVersion < CURRENT_EXPORT_VERSION) {
    warnings.push(
      `Export version ${manifest.exportVersion} is older than current ${CURRENT_EXPORT_VERSION}. Data transforms may be applied.`
    );
  }

  if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Schema version ${manifest.schemaVersion} is newer than current ${CURRENT_SCHEMA_VERSION}. Please upgrade the application before importing.`,
    };
  }

  if (manifest.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `Schema version mismatch: export=${manifest.schemaVersion}, current=${CURRENT_SCHEMA_VERSION}`
    );
  }

  if (!manifest.scope?.orgId) {
    return { valid: false, error: "Missing scope.orgId" };
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}
