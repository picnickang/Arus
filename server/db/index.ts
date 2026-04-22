/**
 * Database Repository Index
 *
 * Central export point for all domain repositories.
 * Each repository provides both Mem and Database implementations.
 *
 * Usage:
 *   import { memEquipmentStorage, dbEquipmentStorage } from './db';
 *   import { memWorkOrderStorage, dbWorkOrderStorage } from './db';
 *
 * Architecture:
 * - Each Mem* class stores data in Maps for testing/development
 * - Each Database* class uses Drizzle ORM against PostgreSQL
 * - Both implement the same interface for interchangeability
 */

// Equipment domain
export * from "./equipment/index.js";

// Work Orders domain
export * from "./workorders/index.js";

// Vessels domain
export * from "./vessels/index.js";

// Alerts domain
export * from "./alerts/index.js";

// Inventory domain
export * from "./inventory/index.js";

// Maintenance domain
export * from "./maintenance/index.js";

// Telemetry domain
export * from "./telemetry/index.js";

// Crew domain
export * from "./crew/index.js";

// Devices domain
export * from "./devices/index.js";

// Additional domains
export * from "./analytics/index.js";
export * from "./checklists/index.js";
export * from "./sensors/index.js";
export * from "./stcw/index.js";
export * from "./optimizer/index.js";
export * from "./system-admin/index.js";

// Re-export db client for direct access when needed
export { db, isLocalMode, deploymentMode } from "../db-config";
