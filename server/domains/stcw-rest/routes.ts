/**
 * STCW Hours of Rest Domain Routes - Backward Compatibility Shim
 *
 * This file maintains backward compatibility with existing imports.
 * The actual implementation has been modularized into server/domains/stcw-rest/routes/
 *
 * @see ./routes/index.ts - Main orchestrator
 * @see ./routes/import.ts - Import and compliance check routes
 * @see ./routes/data.ts - Data retrieval and export routes
 * @see ./routes/range.ts - Range queries and planning preparation
 * @see ./routes/fatigue.ts - Fatigue risk assessment routes
 * @see ./routes/admin.ts - Data management operations
 */

export { registerStcwRestRoutes, type StcwRestDependencies, type RestDay } from "./routes/index";
