/**
 * Test-only Schema Facade
 *
 * This module provides a static PostgreSQL-only export of the schema
 * for Jest tests. It bypasses the runtime mode switching in schema-runtime.ts
 * which causes issues with Jest's ESM module linker.
 *
 * Jest uses this via moduleNameMapper in jest.config.mjs
 */

export const DEPLOYMENT_MODE = "CLOUD";
export const IS_SQLITE = false;
export const IS_POSTGRES = true;

export * from "../../shared/schema";
export type * from "../../shared/schema";
export type * from "../../shared/schema-sqlite-vessel";
export type * from "../../shared/schema-sqlite-sync";

// LR-1D — the production `@shared/schema-runtime` barrel re-exports
// Zod request validators from `shared/validation/*`. Mirror them here
// so tests that import the route modules (e.g. ml model-routes,
// promote two-person rule) get the real validators rather than
// `undefined`.
export { mlAcousticDataSchema, mlTrainConfigSchema } from "../../shared/validation/ml";
