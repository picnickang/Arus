/**
 * ML Analytics Domain Routes - Backward Compatibility Shim
 * 
 * This file re-exports from the modularized routes/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/domains/ml-analytics/routes/index.ts for the modular implementation
 */

export type { MlAnalyticsConfig } from "./routes/index.js";
export { registerMlAnalyticsRoutes } from "./routes/index.js";
