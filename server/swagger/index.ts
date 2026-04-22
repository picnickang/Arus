/**
 * Swagger Module - Aggregator
 *
 * Re-exports all swagger modules for convenient imports.
 *
 * Module structure (1,050 lines → 12 modules):
 * - spec-info.ts (~70 lines): Info, servers, tags
 * - schemas.ts (~190 lines): Component schemas
 * - parameters-responses.ts (~90 lines): Parameters and responses
 * - paths-health.ts (~95 lines): Health and dashboard paths
 * - paths-equipment.ts (~145 lines): Equipment paths
 * - paths-vessels.ts (~75 lines): Vessels paths
 * - paths-telemetry.ts (~65 lines): Telemetry paths
 * - paths-pdm.ts (~65 lines): PdM paths
 * - paths-workorders.ts (~95 lines): Work orders paths
 * - paths-misc.ts (~135 lines): Parts, ML, Analytics, Sync, Orgs, Admin paths
 * - ui-generator.ts (~45 lines): Swagger UI HTML generator
 * - swagger.ts (~65 lines): Main spec assembler
 * - index.ts (~25 lines): This aggregator
 */

export { specInfo } from "./spec-info.js";
export { schemas } from "./schemas.js";
export { securitySchemes, parameters, responses } from "./parameters-responses.js";
export { healthPaths, dashboardPaths } from "./paths-health.js";
export { equipmentPaths } from "./paths-equipment.js";
export { vesselsPaths } from "./paths-vessels.js";
export { telemetryPaths } from "./paths-telemetry.js";
export { pdmPaths } from "./paths-pdm.js";
export { workOrdersPaths } from "./paths-workorders.js";
export {
  partsPaths,
  mlPaths,
  analyticsPaths,
  syncPaths,
  organizationsPaths,
  adminPaths,
} from "./paths-misc.js";
export { generateSwaggerUI } from "./ui-generator.js";
export { openApiSpec, registerSwaggerRoutes } from "./swagger.js";
