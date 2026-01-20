/**
 * SQLite Init Domain Organization
 * 
 * This module provides a manifest of all 142+ tables organized by domain
 * for the SQLite database initialization (vessel offline mode).
 * 
 * The actual CREATE TABLE statements remain in sqlite-init.ts for
 * execution efficiency, but this manifest provides documentation
 * and organizational structure for maintainability.
 */

export type { SqliteDomainDefinition, SqliteDomainMap } from "./types.js";
export { SqliteDomains, type SqliteDomainName } from "./manifest.js";
export { getTableCount, getIndexCount, getTablesByDomain, findTableDomain, getAllTables, getAllIndexes, getDomainSummary, validateManifest } from "./helpers.js";
