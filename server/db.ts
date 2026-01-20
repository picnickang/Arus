/**
 * Database Configuration
 *
 * This file now re-exports from db-config.ts to maintain backward compatibility
 * while supporting dual-mode deployment (cloud PostgreSQL or local SQLite with sync).
 *
 * Deployment Modes:
 * - Cloud Mode (DEFAULT): Uses PostgreSQL (Neon) for always-online deployments
 * - Local Mode: Uses SQLite with Turso sync for vessel/offline deployments
 *
 * Configuration:
 * Set LOCAL_MODE=true in .env to enable local/vessel mode
 */

export { db, pool, isLocalMode, deploymentMode, libsqlClient } from "./db-config";
