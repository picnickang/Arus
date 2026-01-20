/**
 * OpenAPI/Swagger Specification - Backward Compatibility Shim
 * 
 * DEPRECATED: This file re-exports from the modular swagger/ directory.
 * New code should import directly from './swagger/index.js'.
 * 
 * Original: 1,050 lines → Modularized into 12 files:
 * - swagger/spec-info.ts (~70 lines): Info, servers, tags
 * - swagger/schemas.ts (~190 lines): Component schemas
 * - swagger/parameters-responses.ts (~90 lines): Parameters and responses
 * - swagger/paths-health.ts (~95 lines): Health and dashboard paths
 * - swagger/paths-equipment.ts (~145 lines): Equipment paths
 * - swagger/paths-vessels.ts (~75 lines): Vessels paths
 * - swagger/paths-telemetry.ts (~65 lines): Telemetry paths
 * - swagger/paths-pdm.ts (~65 lines): PdM paths
 * - swagger/paths-workorders.ts (~95 lines): Work orders paths
 * - swagger/paths-misc.ts (~135 lines): Parts, ML, Analytics, Sync, Orgs, Admin paths
 * - swagger/ui-generator.ts (~45 lines): Swagger UI HTML generator
 * - swagger/swagger.ts (~65 lines): Main spec assembler
 * - swagger/index.ts (~25 lines): Module aggregator
 */

export { openApiSpec, registerSwaggerRoutes } from "./swagger/index.js";
